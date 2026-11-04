import { moroccoZone } from '@cabinova/morocco-time';
import type { Pool, PoolClient } from '@neondatabase/serverless';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isWithinOpeningHours,
  type OpeningHours,
} from '../settings/opening-hours.js';
import { noShowsOf } from '../patients/no-shows.js';
import {
  type AppointmentDto,
  type AppointmentStatus,
  type ListAppointmentsQuery,
  RELEASED_STATUSES,
  type WalkInDto,
} from './dto.js';

const MAX_DURATION_MS = 12 * 60 * 60 * 1000;
/** A list without a range (patient history) is capped. */
const HISTORY_LIMIT = 200;

/** An appointment as the API returns it. */
const APPOINTMENT = `
  a.id, a.starts_at as "startsAt", a.ends_at as "endsAt", a.status,
  a.reason, a.notes, a.arrived_at as "arrivedAt", a.walk_in as "walkIn",
  a.left_at as "leftAt",
  json_build_object('id', p.id, 'firstName', p.first_name, 'lastName', p.last_name,
    'fileNumber', p.file_number, 'phone', p.phone, 'birthDate', to_char(p.birth_date, 'YYYY-MM-DD'),
    'sex', p.sex, 'noShows', ${noShowsOf('p.id')}) as patient,
  json_build_object('id', u.id, 'name', u.name) as practitioner`;
const FROM = `appointments a
  join patients p on p.id = a.patient_id
  join users u on u.id = a.practitioner_id`;

const RELEASED = RELEASED_STATUSES.map((s) => `'${s}'`).join(', ');

const time = (d: Date) =>
  d.toLocaleTimeString('fr-MA', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: moroccoZone(d),
  });

/**
 * The doctor's steps: calling the patient in, and finishing. The front desk
 * checks patients in and out, but never moves a visit into or out of them.
 */
const DOCTOR_STATUSES: readonly AppointmentStatus[] = [
  'in_consultation',
  'completed',
];

/** New appointments name their act; older ones without one can still be edited. */
function requireReason(reason: string | null | undefined) {
  if (!reason?.trim()) {
    throw new BadRequestException({
      code: 'REASON_REQUIRED',
      message: 'Choisissez un acte.',
    });
  }
}

/**
 * A space's agenda. Every query is filtered by the space; the patient must
 * belong to it. A practitioner is never double-booked, in any space (a
 * doctor can't be in Fès and Marrakech at once), unless the user accepts
 * it ("Réserver quand même"). Nothing is booked or moved outside the space's
 * opening hours.
 */
@Injectable()
export class AppointmentsService {
  /** Doctors who can be booked in this space: the owner, and doctor members. */
  async practitioners(db: Pool | PoolClient, spaceId: string) {
    const { rows } = await db.query<{ id: string; name: string }>(
      `select u.id, u.name from users u
        where u.active and (u.role = 'owner' or (u.role = 'doctor' and exists (
          select 1 from space_members m where m.user_id = u.id and m.space_id = $1)))
        order by u.role = 'owner' desc, u.name`,
      [spaceId],
    );
    return rows;
  }

  async list(db: Pool, spaceId: string, query: ListAppointmentsQuery) {
    if (!query.patientId && (!query.from || !query.to)) {
      throw new BadRequestException({
        code: 'PERIOD_REQUIRED',
        message: 'Indiquez une période (from, to).',
      });
    }
    const where = ['a.space_id = $1'];
    const params: unknown[] = [spaceId];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (query.from && query.to) {
      where.push(
        `a.starts_at < ${param(query.to)} and a.ends_at > ${param(query.from)}`,
      );
    }
    if (query.practitionerId)
      where.push(`a.practitioner_id = ${param(query.practitionerId)}`);
    if (query.patientId) where.push(`a.patient_id = ${param(query.patientId)}`);
    if (!query.includeCancelled) where.push(`a.status not in (${RELEASED})`);

    const history = !query.from;
    const { rows } = await db.query(
      `select ${APPOINTMENT} from ${FROM} where ${where.join(' and ')}
        order by a.starts_at ${history ? 'desc' : 'asc'}
        ${history ? `limit ${HISTORY_LIMIT}` : ''}`,
      params,
    );
    return rows;
  }

  async create(db: Pool, spaceId: string, dto: AppointmentDto, userId: string) {
    requireReason(dto.reason);
    return this.transaction(db, async (tx) => {
      const values = await this.validate(tx, spaceId, dto);
      const { rows } = await tx.query<{ id: string }>(
        `insert into appointments
           (space_id, patient_id, practitioner_id, starts_at, ends_at, reason, notes, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
        [
          spaceId,
          values.patientId,
          values.practitionerId,
          values.startsAt,
          values.endsAt,
          values.reason,
          values.notes,
          userId,
        ],
      );
      return this.find(tx, spaceId, rows[0].id);
    });
  }

  /**
   * A patient who came without an appointment: booked from now for the
   * cabinet's usual duration, already in the waiting room. Neither opening
   * hours nor the doctor's other appointments stop it: the patient is here.
   */
  async walkIn(db: Pool, spaceId: string, dto: WalkInDto, userId: string) {
    requireReason(dto.reason);
    return this.transaction(db, async (tx) => {
      await this.assertPatient(tx, spaceId, dto.patientId);
      await this.assertPractitioner(tx, spaceId, dto.practitionerId);
      // Lock the patient's row: two desks adding them at once make one visit.
      await tx.query('select 1 from patients where id = $1 for update', [
        dto.patientId,
      ]);
      const zone = moroccoZone(new Date());
      const { rowCount: waiting } = await tx.query(
        `select 1 from appointments
          where patient_id = $1 and status in ('arrived', 'in_consultation')
            and (starts_at at time zone $2)::date = (now() at time zone $2)::date`,
        [dto.patientId, zone],
      );
      if (waiting) {
        throw new ConflictException({
          code: 'ALREADY_WAITING',
          message: 'Ce patient est déjà en salle d’attente ou en consultation.',
        });
      }
      const { rows } = await tx.query<{ id: string }>(
        `insert into appointments
           (space_id, patient_id, practitioner_id, starts_at, ends_at, reason, notes,
            status, arrived_at, walk_in, created_by)
         select $1, $2, $3, t, t + make_interval(mins => coalesce(
                  (select default_appointment_minutes from clinic_settings where id = 1), 30)),
                $4, $5, 'arrived', now(), true, $6
           from date_trunc('minute', now()) t
         returning id`,
        [
          spaceId,
          dto.patientId,
          dto.practitionerId,
          dto.reason,
          dto.notes ?? null,
          userId,
        ],
      );
      return this.find(tx, spaceId, rows[0].id);
    });
  }

  async update(db: Pool, spaceId: string, id: string, dto: AppointmentDto) {
    return this.transaction(db, async (tx) => {
      const current = await this.find(tx, spaceId, id);
      if (current.status === 'completed') {
        throw new BadRequestException({
          code: 'COMPLETED',
          message: 'Un rendez-vous terminé ne peut plus être modifié.',
        });
      }
      const values = await this.validate(tx, spaceId, dto, current);
      await tx.query(
        `update appointments set patient_id = $3, practitioner_id = $4,
           starts_at = $5, ends_at = $6, reason = $7, notes = $8, updated_at = now()
         where id = $1 and space_id = $2`,
        [
          id,
          spaceId,
          values.patientId,
          values.practitionerId,
          values.startsAt,
          values.endsAt,
          values.reason,
          values.notes,
        ],
      );
      return this.find(tx, spaceId, id);
    });
  }

  async setStatus(
    db: Pool,
    spaceId: string,
    id: string,
    status: AppointmentStatus,
    /** A doctor (or the owner): only they call patients in and finish. */
    medical: boolean,
  ) {
    return this.transaction(db, async (tx) => {
      const current = await this.find(tx, spaceId, id);
      if (
        !medical &&
        (DOCTOR_STATUSES.includes(status) ||
          DOCTOR_STATUSES.includes(current.status))
      ) {
        throw new ForbiddenException({
          code: 'DOCTOR_STEP',
          message:
            'C’est le médecin qui fait entrer le patient et termine la consultation.',
        });
      }
      // Re-activating a cancelled appointment needs its slot to still be free.
      if (
        RELEASED_STATUSES.includes(current.status) &&
        !RELEASED_STATUSES.includes(status)
      ) {
        await this.assertSlotFree(
          tx,
          current.practitioner.id,
          new Date(current.startsAt),
          new Date(current.endsAt),
          id,
        );
      }
      // The arrival time orders the waiting room; it's cleared if the
      // patient is marked as not yet arrived again.
      const arrived =
        status === 'arrived' ||
        status === 'in_consultation' ||
        status === 'completed'
          ? 'coalesce(arrived_at, now())'
          : status === 'no_show' || status === 'cancelled'
            ? 'arrived_at'
            : 'null';
      await tx.query(
        `update appointments set status = $3, arrived_at = ${arrived}, left_at = null,
           updated_at = now()
          where id = $1 and space_id = $2`,
        [id, spaceId, status],
      );
      return this.find(tx, spaceId, id);
    });
  }

  /**
   * The patient left the waiting room without being seen: the visit is
   * cancelled (the slot is free again), remembering when they left.
   */
  async left(db: Pool, spaceId: string, id: string) {
    return this.transaction(db, async (tx) => {
      const current = await this.find(tx, spaceId, id);
      if (current.status !== 'arrived') {
        throw new BadRequestException({
          code: 'NOT_WAITING',
          message: 'Ce patient n’est pas en salle d’attente.',
        });
      }
      await tx.query(
        `update appointments set status = 'cancelled', left_at = now(), updated_at = now()
          where id = $1 and space_id = $2`,
        [id, spaceId],
      );
      return this.find(tx, spaceId, id);
    });
  }

  /**
   * They came back the same day: into the waiting room again, behind those
   * already there. Another day, they're booked again (or come as a walk-in).
   */
  async returned(db: Pool, spaceId: string, id: string) {
    return this.transaction(db, async (tx) => {
      const current = await this.find(tx, spaceId, id);
      const zone = moroccoZone(new Date());
      const day = (d: Date) =>
        d.toLocaleDateString('en-CA', { timeZone: zone });
      if (
        current.status !== 'cancelled' ||
        !current.leftAt ||
        day(new Date(current.leftAt)) !== day(new Date())
      ) {
        throw new BadRequestException({
          code: 'CANNOT_RETURN',
          message:
            'Seul un patient parti aujourd’hui peut revenir en salle d’attente.',
        });
      }
      await tx.query(
        `update appointments set status = 'arrived', arrived_at = now(), left_at = null,
           updated_at = now()
          where id = $1 and space_id = $2`,
        [id, spaceId],
      );
      return this.find(tx, spaceId, id);
    });
  }

  private async transaction<T>(db: Pool, fn: (tx: PoolClient) => Promise<T>) {
    const client = await db.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  private async find(tx: PoolClient, spaceId: string, id: string) {
    const { rows } = await tx.query<{
      id: string;
      status: AppointmentStatus;
      startsAt: string;
      endsAt: string;
      leftAt: string | null;
      practitioner: { id: string; name: string };
    }>(
      `select ${APPOINTMENT} from ${FROM} where a.id = $1 and a.space_id = $2`,
      [id, spaceId],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Rendez-vous introuvable.',
      });
    }
    return rows[0];
  }

  /** Checks the patient, the practitioner and the slot; returns the values to write. */
  private async validate(
    tx: PoolClient,
    spaceId: string,
    dto: AppointmentDto,
    /** Updating: an appointment that keeps its time is left alone. */
    current?: { id: string; startsAt: string; endsAt: string },
  ) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const duration = endsAt.getTime() - startsAt.getTime();
    if (duration <= 0 || duration > MAX_DURATION_MS) {
      throw new BadRequestException({
        code: 'INVALID_TIME',
        message: "L'heure de fin doit suivre l'heure de début (12 h maximum).",
      });
    }
    await this.assertPatient(tx, spaceId, dto.patientId);
    await this.assertPractitioner(tx, spaceId, dto.practitionerId);
    const moved =
      !current ||
      new Date(current.startsAt).getTime() !== startsAt.getTime() ||
      new Date(current.endsAt).getTime() !== endsAt.getTime();
    if (moved) await this.assertOpen(tx, spaceId, startsAt, endsAt);
    if (!dto.allowOverlap) {
      await this.assertSlotFree(
        tx,
        dto.practitionerId,
        startsAt,
        endsAt,
        current?.id,
      );
    }
    return {
      patientId: dto.patientId,
      practitionerId: dto.practitionerId,
      startsAt,
      endsAt,
      reason: dto.reason ?? null,
      notes: dto.notes ?? null,
    };
  }

  private async assertPatient(tx: PoolClient, spaceId: string, id: string) {
    const { rowCount } = await tx.query(
      'select 1 from patients where id = $1 and space_id = $2 and archived_at is null',
      [id, spaceId],
    );
    if (!rowCount) {
      throw new BadRequestException({
        code: 'PATIENT_UNAVAILABLE',
        message: 'Patient introuvable dans cet espace, ou archivé.',
      });
    }
  }

  private async assertPractitioner(
    tx: PoolClient,
    spaceId: string,
    id: string,
  ) {
    const practitioners = await this.practitioners(tx, spaceId);
    if (!practitioners.some((p) => p.id === id)) {
      throw new BadRequestException({
        code: 'PRACTITIONER_UNAVAILABLE',
        message: 'Ce praticien ne consulte pas dans cet espace.',
      });
    }
  }

  private async assertOpen(
    tx: PoolClient,
    spaceId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const { rows } = await tx.query<{ opening_hours: OpeningHours }>(
      'select opening_hours from spaces where id = $1',
      [spaceId],
    );
    if (!isWithinOpeningHours(startsAt, endsAt, rows[0].opening_hours)) {
      throw new BadRequestException({
        code: 'OUTSIDE_HOURS',
        message:
          'Ce créneau est en dehors des horaires d’ouverture du cabinet.',
      });
    }
  }

  /**
   * No double booking for a practitioner, across spaces. The advisory lock
   * serialises bookings of the same practitioner until the transaction ends,
   * so two receptionists can't take the same slot at the same moment.
   */
  private async assertSlotFree(
    tx: PoolClient,
    practitionerId: string,
    startsAt: Date,
    endsAt: Date,
    exceptId?: string,
  ) {
    await tx.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
      practitionerId,
    ]);
    const { rows } = await tx.query<{
      starts_at: Date;
      ends_at: Date;
      space: string;
    }>(
      `select a.starts_at, a.ends_at, s.name as space
         from appointments a join spaces s on s.id = a.space_id
        where a.practitioner_id = $1 and a.starts_at < $3 and a.ends_at > $2
          and a.status not in (${RELEASED}) and a.id <> coalesce($4::uuid, '00000000-0000-0000-0000-000000000000')
        order by a.starts_at limit 1`,
      [practitionerId, startsAt, endsAt, exceptId ?? null],
    );
    const conflict = rows[0];
    if (conflict) {
      throw new ConflictException({
        code: 'SLOT_TAKEN',
        params: {
          from: time(conflict.starts_at),
          to: time(conflict.ends_at),
          space: conflict.space,
        },
        message: `Le praticien a déjà un rendez-vous de ${time(conflict.starts_at)} à ${time(conflict.ends_at)} (${conflict.space}).`,
      });
    }
  }
}
