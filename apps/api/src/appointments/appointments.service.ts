import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt, isNull, lt, ne, notInArray, sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types.js';
import { audit } from '../common/audit.js';
import {
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  appointments,
  consultations,
  patients,
  roles,
  userRoles,
  users,
} from '../database/schema/index.js';
import {
  type AppointmentDto,
  type AppointmentStatus,
  type ListAppointmentsQuery,
  RELEASED_STATUSES,
} from './dto.js';

/** Role whose members can be booked. */
const PRACTITIONER_ROLE = 'doctor';
const MAX_DURATION_MS = 12 * 60 * 60 * 1000;
/** A range query is capped (the year view loads 12 months at most). */
const MAX_RANGE_MS = 400 * 24 * 60 * 60 * 1000;

const columns = {
  id: appointments.id,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  status: appointments.status,
  reason: appointments.reason,
  notes: appointments.notes,
  patient: {
    id: patients.id,
    firstName: patients.firstName,
    lastName: patients.lastName,
    fileNumber: patients.fileNumber,
    phone: patients.phone,
  },
  practitioner: { id: users.id, name: users.name },
  /** Set once a consultation was started from this appointment. */
  consultationId: consultations.id,
};

@Injectable()
export class AppointmentsService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Appointments overlapping [from, to). Without a range (patient history,
   * `patientId` required), every appointment of the patient.
   */
  list(query: ListAppointmentsQuery) {
    const ranged = query.from !== undefined || query.to !== undefined;
    const from = new Date(query.from ?? 0);
    const to = new Date(query.to ?? 0);
    if (ranged) {
      if (
        !query.from ||
        !query.to ||
        to <= from ||
        to.getTime() - from.getTime() > MAX_RANGE_MS
      ) {
        throw new BadRequestException('Période invalide.');
      }
    } else if (!query.patientId) {
      throw new BadRequestException('Période ou patient requis.');
    }
    return this.database.tenant((tx) =>
      this.select(tx)
        .where(
          and(
            ranged ? lt(appointments.startsAt, to) : undefined,
            ranged ? gt(appointments.endsAt, from) : undefined,
            query.practitionerId
              ? eq(appointments.practitionerId, query.practitionerId)
              : undefined,
            query.patientId
              ? eq(appointments.patientId, query.patientId)
              : undefined,
            query.includeCancelled
              ? undefined
              : notInArray(appointments.status, RELEASED_STATUSES),
          ),
        )
        .orderBy(asc(appointments.startsAt)),
    );
  }

  /** Active members with the doctor role: the people you can book. */
  practitioners() {
    return this.database.tenant((tx) => this.practitionersQuery(tx));
  }

  create(user: AuthUser, dto: AppointmentDto) {
    return this.database.tenant(async (tx) => {
      const values = await this.validate(tx, dto);
      const [created] = await tx
        .insert(appointments)
        .values({ ...values, tenantId: user.tenantId, createdById: user.id })
        .returning({ id: appointments.id });
      await audit(tx, user, {
        action: 'appointment.create',
        entity: 'appointment',
        entityId: created.id,
      });
      return this.find(tx, created.id);
    });
  }

  update(user: AuthUser, id: string, dto: AppointmentDto) {
    return this.database.tenant(async (tx) => {
      const current = await this.find(tx, id);
      if (current.status === 'completed') {
        throw new BadRequestException(
          'Un rendez-vous terminé ne peut plus être modifié.',
        );
      }
      const values = await this.validate(tx, dto, id);
      await tx.update(appointments).set(values).where(eq(appointments.id, id));
      const moved =
        current.startsAt.getTime() !== values.startsAt.getTime() ||
        current.endsAt.getTime() !== values.endsAt.getTime() ||
        current.practitioner.id !== values.practitionerId;
      await audit(tx, user, {
        action: moved ? 'appointment.move' : 'appointment.update',
        entity: 'appointment',
        entityId: id,
      });
      return this.find(tx, id);
    });
  }

  setStatus(user: AuthUser, id: string, status: AppointmentStatus) {
    return this.database.tenant(async (tx) => {
      const current = await this.find(tx, id);
      // Re-activating a cancelled appointment needs its slot to still be free.
      if (
        RELEASED_STATUSES.includes(current.status) &&
        !RELEASED_STATUSES.includes(status)
      ) {
        await this.assertSlotFree(
          tx,
          current.practitioner.id,
          current.startsAt,
          current.endsAt,
          id,
        );
      }
      await tx
        .update(appointments)
        .set({ status })
        .where(eq(appointments.id, id));
      await audit(tx, user, {
        action: 'appointment.status',
        entity: 'appointment',
        entityId: id,
        metadata: { from: current.status, to: status },
      });
      return this.find(tx, id);
    });
  }

  private practitionersQuery(tx: Transaction) {
    return tx
      .selectDistinct({ id: users.id, name: users.name })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(roles.key, PRACTITIONER_ROLE), eq(users.active, true)))
      .orderBy(asc(users.name));
  }

  private select(tx: Transaction) {
    return tx
      .select(columns)
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(users, eq(users.id, appointments.practitionerId))
      .leftJoin(
        consultations,
        eq(consultations.appointmentId, appointments.id),
      );
  }

  private async find(tx: Transaction, id: string) {
    const [row] = await this.select(tx).where(eq(appointments.id, id));
    if (!row) throw new NotFoundException('Rendez-vous introuvable.');
    return row;
  }

  /** Checks the patient, the practitioner and the slot; returns the columns to write. */
  private async validate(
    tx: Transaction,
    dto: AppointmentDto,
    exceptId?: string,
  ) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const duration = endsAt.getTime() - startsAt.getTime();
    if (duration <= 0 || duration > MAX_DURATION_MS) {
      throw new BadRequestException(
        "L'heure de fin doit suivre l'heure de début (12 h maximum).",
      );
    }

    const [patient] = await tx
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, dto.patientId), isNull(patients.archivedAt)));
    if (!patient)
      throw new BadRequestException('Patient introuvable ou archivé.');

    const practitioners = await this.practitionersQuery(tx);
    if (!practitioners.some((p) => p.id === dto.practitionerId)) {
      throw new BadRequestException('Praticien introuvable.');
    }

    await this.assertSlotFree(
      tx,
      dto.practitionerId,
      startsAt,
      endsAt,
      exceptId,
    );

    return {
      patientId: dto.patientId,
      practitionerId: dto.practitionerId,
      startsAt,
      endsAt,
      reason: dto.reason ?? null,
      notes: dto.notes ?? null,
    };
  }

  /**
   * No double booking for a practitioner. The advisory lock serialises
   * bookings of the same practitioner until the transaction ends.
   */
  private async assertSlotFree(
    tx: Transaction,
    practitionerId: string,
    startsAt: Date,
    endsAt: Date,
    exceptId?: string,
  ) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${practitionerId}, 0))`,
    );
    const [conflict] = await tx
      .select({
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.practitionerId, practitionerId),
          lt(appointments.startsAt, endsAt),
          gt(appointments.endsAt, startsAt),
          notInArray(appointments.status, RELEASED_STATUSES),
          exceptId ? ne(appointments.id, exceptId) : undefined,
        ),
      )
      .limit(1);
    if (conflict) {
      const time = (d: Date) =>
        d.toLocaleTimeString('fr-MA', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Casablanca',
        });
      throw new ConflictException({
        code: 'SLOT_TAKEN',
        message: `Le praticien a déjà un rendez-vous de ${time(conflict.startsAt)} à ${time(conflict.endsAt)}.`,
      });
    }
  }
}
