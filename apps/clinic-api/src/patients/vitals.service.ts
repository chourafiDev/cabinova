import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import type { VitalSignsDto } from './dto.js';

/** Writable columns, in the DTO's keys. */
const FIELDS = [
  ['weight_kg', 'weightKg'],
  ['height_cm', 'heightCm'],
  ['temperature_c', 'temperatureC'],
  ['blood_group', 'bloodGroup'],
  ['glycemia', 'glycemia'],
  ['glycemia_postprandial', 'glycemiaPostprandial'],
  ['hba1c', 'hba1c'],
  ['bp_right_systolic', 'bpRightSystolic'],
  ['bp_right_diastolic', 'bpRightDiastolic'],
  ['bp_left_systolic', 'bpLeftSystolic'],
  ['bp_left_diastolic', 'bpLeftDiastolic'],
  ['heart_rate', 'heartRate'],
  ['spo2', 'spo2'],
  ['waist_cm', 'waistCm'],
  ['head_circumference_cm', 'headCircumferenceCm'],
  ['abdominal_circumference_cm', 'abdominalCircumferenceCm'],
] as const;

/** numeric comes back as text: numbers for the app. */
const VITALS = `
  v.id, v.measured_at as "measuredAt", v.recorded_by as "recordedById",
  u.name as "recordedBy", v.note,
  ${FIELDS.map(([column, key]) =>
    column === 'blood_group'
      ? `v.blood_group as "${key}"`
      : `v.${column}::float8 as "${key}"`,
  ).join(', ')}`;

/** A measurement can't be dated later than now (a minute of clock drift). */
const DRIFT_MS = 60_000;

/**
 * Constantes of a patient of the request's space. The whole staff records
 * them; a session is removed by whoever took it or the responsible doctor.
 */
@Injectable()
export class VitalsService {
  async list(db: Pool, spaceId: string, patientId: string) {
    await this.patient(db, spaceId, patientId);
    const { rows } = await db.query(
      `select ${VITALS}
         from vital_signs v left join users u on u.id = v.recorded_by
        where v.patient_id = $1
        order by v.measured_at desc, v.created_at desc
        limit 200`,
      [patientId],
    );
    return rows;
  }

  async create(
    db: Pool,
    spaceId: string,
    patientId: string,
    dto: VitalSignsDto,
    userId: string,
  ) {
    const patient = await this.patient(db, spaceId, patientId);
    if (patient.archived) {
      throw new ConflictException({
        code: 'PATIENT_ARCHIVED',
        message:
          'Ce dossier est archivé : restaurez-le pour ajouter des constantes.',
      });
    }
    const values = FIELDS.map(([, key]) => dto[key] ?? null);
    if (values.every((v) => v === null)) {
      throw new BadRequestException({
        code: 'VITALS_EMPTY',
        message: 'Saisissez au moins une constante.',
      });
    }
    for (const side of ['Right', 'Left'] as const) {
      const systolic = dto[`bp${side}Systolic`] ?? null;
      const diastolic = dto[`bp${side}Diastolic`] ?? null;
      if ((systolic === null) !== (diastolic === null)) {
        throw new BadRequestException({
          code: 'BP_INCOMPLETE',
          message:
            'Saisissez les deux valeurs de la tension (systolique et diastolique).',
        });
      }
      if (systolic !== null && diastolic !== null && systolic <= diastolic) {
        throw new BadRequestException({
          code: 'BP_ORDER',
          message: 'La systolique doit être supérieure à la diastolique.',
        });
      }
    }
    const measuredAt = dto.measuredAt ? new Date(dto.measuredAt) : new Date();
    if (measuredAt.getTime() > Date.now() + DRIFT_MS) {
      throw new BadRequestException({
        code: 'MEASURED_IN_FUTURE',
        message: 'La date de la mesure ne peut pas être dans le futur.',
      });
    }
    const columns = FIELDS.map(([c]) => c);
    const { rows } = await db.query<{ id: string }>(
      `insert into vital_signs
         (patient_id, measured_at, recorded_by, note, ${columns.join(', ')})
       values ($1, $2, $3, $4, ${columns.map((_, i) => `$${i + 5}`).join(', ')})
       returning id`,
      [patientId, measuredAt, userId, dto.note ?? null, ...values],
    );
    return this.one(db, rows[0].id);
  }

  async remove(
    db: Pool,
    spaceId: string,
    patientId: string,
    id: string,
    user: ClinicUser,
  ) {
    await this.patient(db, spaceId, patientId);
    const { rows } = await db.query<{ recorded_by: string | null }>(
      'select recorded_by from vital_signs where id = $1 and patient_id = $2',
      [id, patientId],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'VITALS_NOT_FOUND',
        message: 'Mesure introuvable.',
      });
    }
    if (user.role !== 'owner' && rows[0].recorded_by !== user.id) {
      throw new ForbiddenException({
        code: 'NOT_YOURS',
        key: 'VITALS_NOT_YOURS',
        message:
          'Seul(e) la personne qui l’a saisie ou le médecin responsable peut supprimer cette mesure.',
      });
    }
    await db.query('delete from vital_signs where id = $1', [id]);
    return { ok: true };
  }

  private async one(db: Pool, id: string) {
    const { rows } = await db.query(
      `select ${VITALS}
         from vital_signs v left join users u on u.id = v.recorded_by
        where v.id = $1`,
      [id],
    );
    return rows[0];
  }

  private async patient(db: Pool, spaceId: string, id: string) {
    const { rows } = await db.query<{ archived: boolean }>(
      `select archived_at is not null as archived
         from patients where id = $1 and space_id = $2`,
      [id, spaceId],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'PATIENT_NOT_FOUND',
        message: 'Patient introuvable.',
      });
    }
    return rows[0];
  }
}
