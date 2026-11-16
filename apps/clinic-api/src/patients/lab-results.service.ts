import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { today } from '../reports/period.js';
import type { LabResultDto } from './dto.js';

const RESULT = `
  r.id, r.name, r.unit, r.value, to_char(r.taken_on, 'YYYY-MM-DD') as "takenOn",
  r.appointment_id as "appointmentId", r.created_at as "createdAt", u.name as "createdBy"`;

/**
 * Bilan biologique of a patient of the request's space: results kept
 * across visits, newest analysis first. Doctors only (the controller checks).
 */
@Injectable()
export class LabResultsService {
  async list(db: Pool, spaceId: string, patientId: string) {
    await this.patient(db, spaceId, patientId);
    const { rows } = await db.query(
      `select ${RESULT}
         from lab_results r left join users u on u.id = r.created_by
        where r.patient_id = $1
        order by r.taken_on desc, r.created_at desc
        limit 500`,
      [patientId],
    );
    return rows;
  }

  async create(
    db: Pool,
    spaceId: string,
    patientId: string,
    dto: LabResultDto,
    userId: string,
  ) {
    await this.patient(db, spaceId, patientId);
    if (Number.isNaN(Date.parse(`${dto.takenOn}T00:00:00Z`))) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: 'Date invalide (AAAA-MM-JJ).',
      });
    }
    if (dto.takenOn > today()) {
      throw new BadRequestException({
        code: 'LAB_IN_FUTURE',
        message: 'La date du bilan ne peut pas être dans le futur.',
      });
    }
    // A visit given must be this patient's.
    if (dto.appointmentId) {
      const { rowCount } = await db.query(
        'select 1 from appointments where id = $1 and patient_id = $2',
        [dto.appointmentId, patientId],
      );
      if (!rowCount) {
        throw new NotFoundException({
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'Rendez-vous introuvable.',
        });
      }
    }
    const { rows } = await db.query<{ id: string }>(
      `insert into lab_results (patient_id, appointment_id, name, unit, value, taken_on, created_by)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [
        patientId,
        dto.appointmentId ?? null,
        dto.name,
        dto.unit ?? null,
        dto.value,
        dto.takenOn,
        userId,
      ],
    );
    const { rows: created } = await db.query(
      `select ${RESULT} from lab_results r left join users u on u.id = r.created_by where r.id = $1`,
      [rows[0].id],
    );
    return created[0];
  }

  async remove(db: Pool, spaceId: string, patientId: string, id: string) {
    await this.patient(db, spaceId, patientId);
    const { rowCount } = await db.query(
      'delete from lab_results where id = $1 and patient_id = $2',
      [id, patientId],
    );
    if (!rowCount) {
      throw new NotFoundException({
        code: 'LAB_RESULT_NOT_FOUND',
        message: 'Résultat introuvable.',
      });
    }
    return { ok: true };
  }

  private async patient(db: Pool, spaceId: string, id: string) {
    const { rowCount } = await db.query(
      'select 1 from patients where id = $1 and space_id = $2',
      [id, spaceId],
    );
    if (!rowCount) {
      throw new NotFoundException({
        code: 'PATIENT_NOT_FOUND',
        message: 'Patient introuvable.',
      });
    }
  }
}
