import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types.js';
import { audit } from '../common/audit.js';
import {
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  appointments,
  consultations,
  medicalProfiles,
  patients,
  users,
} from '../database/schema/index.js';
import type {
  ConsultationDto,
  ListConsultationsQuery,
  MedicalProfileDto,
  StartConsultationDto,
} from './dto.js';

const like = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`;

const patientColumns = {
  id: patients.id,
  firstName: patients.firstName,
  lastName: patients.lastName,
  fileNumber: patients.fileNumber,
  sex: patients.sex,
  birthDate: patients.birthDate,
};

const EMPTY_PROFILE = {
  bloodGroup: null,
  allergies: null,
  chronicConditions: null,
  medicalHistory: null,
  surgicalHistory: null,
  familyHistory: null,
  currentTreatments: null,
  updatedAt: null,
};

@Injectable()
export class ConsultationsService {
  constructor(private readonly database: DatabaseService) {}

  list(query: ListConsultationsQuery) {
    const term = query.search?.trim();
    const where = and(
      query.status
        ? inArray(
            consultations.status,
            query.status.split(',') as ('draft' | 'completed')[],
          )
        : undefined,
      query.practitionerId
        ? eq(consultations.practitionerId, query.practitionerId)
        : undefined,
      query.patientId
        ? eq(consultations.patientId, query.patientId)
        : undefined,
      term ? this.searchCondition(term) : undefined,
    );
    const order =
      query.sort === 'startedAt.asc'
        ? asc(consultations.startedAt)
        : desc(consultations.startedAt);

    return this.database.tenant(async (tx) => {
      const [rows, [{ total }]] = await Promise.all([
        tx
          .select({
            id: consultations.id,
            status: consultations.status,
            startedAt: consultations.startedAt,
            reason: consultations.reason,
            diagnosis: consultations.diagnosis,
            patient: patientColumns,
            practitioner: { id: users.id, name: users.name },
          })
          .from(consultations)
          .innerJoin(patients, eq(patients.id, consultations.patientId))
          .innerJoin(users, eq(users.id, consultations.practitionerId))
          .where(where)
          .orderBy(order, asc(consultations.id))
          .limit(query.perPage)
          .offset((query.page - 1) * query.perPage),
        tx
          .select({ total: count() })
          .from(consultations)
          .innerJoin(patients, eq(patients.id, consultations.patientId))
          .where(where),
      ]);
      return {
        data: rows,
        total,
        pageCount: Math.max(1, Math.ceil(total / query.perPage)),
      };
    });
  }

  /** Full consultation + patient + antécédents. Reading is audited (health data). */
  get(user: AuthUser, id: string) {
    return this.database.tenant(async (tx) => {
      const consultation = await this.find(tx, id);
      const profile = await this.findProfile(tx, consultation.patient.id);
      await audit(tx, user, {
        action: 'consultation.view',
        entity: 'consultation',
        entityId: id,
      });
      return { ...consultation, medicalProfile: profile };
    });
  }

  /** New draft, or the existing one for this appointment (idempotent). */
  start(user: AuthUser, dto: StartConsultationDto) {
    return this.database.tenant(async (tx) => {
      const [patient] = await tx
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(eq(patients.id, dto.patientId), isNull(patients.archivedAt)),
        );
      if (!patient) {
        throw new BadRequestException('Patient introuvable ou archivé.');
      }

      let practitionerId = user.id;
      let reason: string | null = null;
      if (dto.appointmentId) {
        const [appointment] = await tx
          .select({
            patientId: appointments.patientId,
            practitionerId: appointments.practitionerId,
            status: appointments.status,
            reason: appointments.reason,
          })
          .from(appointments)
          .where(eq(appointments.id, dto.appointmentId));
        if (!appointment || appointment.patientId !== dto.patientId) {
          throw new BadRequestException('Rendez-vous introuvable.');
        }
        if (['cancelled', 'no_show'].includes(appointment.status)) {
          throw new BadRequestException(
            'Ce rendez-vous est annulé ou le patient était absent.',
          );
        }
        const [existing] = await tx
          .select({ id: consultations.id })
          .from(consultations)
          .where(eq(consultations.appointmentId, dto.appointmentId));
        if (existing) return { id: existing.id, created: false };
        practitionerId = appointment.practitionerId;
        reason = appointment.reason;
      }

      const [created] = await tx
        .insert(consultations)
        .values({
          tenantId: user.tenantId,
          patientId: dto.patientId,
          practitionerId,
          appointmentId: dto.appointmentId ?? null,
          reason,
          createdById: user.id,
        })
        .returning({ id: consultations.id });
      await audit(tx, user, {
        action: 'consultation.create',
        entity: 'consultation',
        entityId: created.id,
      });
      return { id: created.id, created: true };
    });
  }

  update(user: AuthUser, id: string, dto: ConsultationDto) {
    return this.database.tenant(async (tx) => {
      await this.assertDraft(tx, id);
      await tx
        .update(consultations)
        .set({
          reason: dto.reason ?? null,
          history: dto.history ?? null,
          examination: dto.examination ?? null,
          diagnosis: dto.diagnosis ?? null,
          plan: dto.plan ?? null,
          weightKg: dto.weightKg ?? null,
          heightCm: dto.heightCm ?? null,
          temperatureC: dto.temperatureC ?? null,
          systolic: dto.systolic ?? null,
          diastolic: dto.diastolic ?? null,
          heartRate: dto.heartRate ?? null,
          spo2: dto.spo2 ?? null,
          glycemia: dto.glycemia ?? null,
        })
        .where(eq(consultations.id, id));
      await audit(tx, user, {
        action: 'consultation.update',
        entity: 'consultation',
        entityId: id,
      });
      return this.find(tx, id);
    });
  }

  /** Locks the consultation; its appointment becomes "completed". */
  complete(user: AuthUser, id: string) {
    return this.database.tenant(async (tx) => {
      const consultation = await this.assertDraft(tx, id);
      await tx
        .update(consultations)
        .set({
          status: 'completed',
          completedAt: new Date(),
          completedById: user.id,
        })
        .where(eq(consultations.id, id));
      if (consultation.appointmentId) {
        await tx
          .update(appointments)
          .set({ status: 'completed' })
          .where(eq(appointments.id, consultation.appointmentId));
      }
      await audit(tx, user, {
        action: 'consultation.complete',
        entity: 'consultation',
        entityId: id,
      });
      return this.find(tx, id);
    });
  }

  getProfile(user: AuthUser, patientId: string) {
    return this.database.tenant(async (tx) => {
      await this.assertPatient(tx, patientId);
      const profile = await this.findProfile(tx, patientId);
      await audit(tx, user, {
        action: 'medical_profile.view',
        entity: 'patient',
        entityId: patientId,
      });
      return profile;
    });
  }

  updateProfile(user: AuthUser, patientId: string, dto: MedicalProfileDto) {
    return this.database.tenant(async (tx) => {
      await this.assertPatient(tx, patientId);
      const values = {
        bloodGroup: dto.bloodGroup ?? null,
        allergies: dto.allergies ?? null,
        chronicConditions: dto.chronicConditions ?? null,
        medicalHistory: dto.medicalHistory ?? null,
        surgicalHistory: dto.surgicalHistory ?? null,
        familyHistory: dto.familyHistory ?? null,
        currentTreatments: dto.currentTreatments ?? null,
        updatedById: user.id,
      };
      await tx
        .insert(medicalProfiles)
        .values({ ...values, patientId, tenantId: user.tenantId })
        .onConflictDoUpdate({ target: medicalProfiles.patientId, set: values });
      await audit(tx, user, {
        action: 'medical_profile.update',
        entity: 'patient',
        entityId: patientId,
      });
      return this.findProfile(tx, patientId);
    });
  }

  private async find(tx: Transaction, id: string) {
    const [row] = await tx
      .select({
        consultation: consultations,
        patient: patientColumns,
        practitioner: { id: users.id, name: users.name },
      })
      .from(consultations)
      .innerJoin(patients, eq(patients.id, consultations.patientId))
      .innerJoin(users, eq(users.id, consultations.practitionerId))
      .where(eq(consultations.id, id));
    if (!row) throw new NotFoundException('Consultation introuvable.');
    const {
      tenantId: _tenant,
      patientId: _patient,
      practitionerId: _practitioner,
      ...rest
    } = row.consultation;
    return { ...rest, patient: row.patient, practitioner: row.practitioner };
  }

  private async findProfile(tx: Transaction, patientId: string) {
    const [profile] = await tx
      .select({
        bloodGroup: medicalProfiles.bloodGroup,
        allergies: medicalProfiles.allergies,
        chronicConditions: medicalProfiles.chronicConditions,
        medicalHistory: medicalProfiles.medicalHistory,
        surgicalHistory: medicalProfiles.surgicalHistory,
        familyHistory: medicalProfiles.familyHistory,
        currentTreatments: medicalProfiles.currentTreatments,
        updatedAt: medicalProfiles.updatedAt,
      })
      .from(medicalProfiles)
      .where(eq(medicalProfiles.patientId, patientId));
    return profile ?? EMPTY_PROFILE;
  }

  private async assertDraft(tx: Transaction, id: string) {
    const [row] = await tx
      .select({
        status: consultations.status,
        appointmentId: consultations.appointmentId,
      })
      .from(consultations)
      .where(eq(consultations.id, id));
    if (!row) throw new NotFoundException('Consultation introuvable.');
    if (row.status !== 'draft') {
      throw new ConflictException({
        code: 'CONSULTATION_LOCKED',
        message:
          'Cette consultation est clôturée : elle ne peut plus être modifiée.',
      });
    }
    return row;
  }

  private async assertPatient(tx: Transaction, patientId: string) {
    const [patient] = await tx
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, patientId));
    if (!patient) throw new NotFoundException('Patient introuvable.');
  }

  /** Patient name (any order) or file number. */
  private searchCondition(term: string): SQL | undefined {
    const conditions: (SQL | undefined)[] = [
      ilike(
        sql`${patients.firstName} || ' ' || ${patients.lastName}`,
        like(term),
      ),
      ilike(
        sql`${patients.lastName} || ' ' || ${patients.firstName}`,
        like(term),
      ),
    ];
    if (/^\d+$/.test(term)) {
      conditions.push(eq(patients.fileNumber, Number(term)));
    }
    return or(...conditions);
  }
}
