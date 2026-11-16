import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { richOrNull } from '../common/rich-text.js';
import type { LabRequestDto, LabRequestModelDto } from './dto.js';

const REQUEST = `
  r.id, r.body, r.appointment_id as "appointmentId", r.created_at as "createdAt",
  r.updated_at as "updatedAt", r.practitioner_id as "practitionerId", u.name as practitioner`;
const FROM = `lab_requests r
  join patients p on p.id = r.patient_id
  left join users u on u.id = r.practitioner_id`;

/**
 * Bilans biologiques (doctors write them, the whole staff prints them): the
 * analyses asked of the patient, on the cabinet's letterhead. The doctors'
 * own bilans too.
 */
@Injectable()
export class LabRequestsService {
  /** The patient's bilans in this space, newest first. */
  async list(db: Pool, spaceId: string, patientId: string) {
    await this.patient(db, spaceId, patientId);
    const { rows } = await db.query(
      `select ${REQUEST} from ${FROM}
        where r.patient_id = $1 and p.space_id = $2
        order by r.created_at desc`,
      [patientId, spaceId],
    );
    return rows;
  }

  async create(db: Pool, spaceId: string, dto: LabRequestDto, userId: string) {
    const patient = await this.patient(db, spaceId, dto.patientId);
    if (patient.archived) {
      throw new ConflictException({
        code: 'PATIENT_ARCHIVED',
        message: 'Ce dossier est archivé.',
      });
    }
    const body = required(dto.body);
    if (dto.appointmentId) {
      const { rows } = await db.query(
        `select 1 from appointments where id = $1 and space_id = $2 and patient_id = $3`,
        [dto.appointmentId, spaceId, dto.patientId],
      );
      if (!rows[0]) {
        throw new NotFoundException({
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'Rendez-vous introuvable.',
        });
      }
    }
    const { rows } = await db.query<{ id: string }>(
      `insert into lab_requests (patient_id, appointment_id, practitioner_id, body)
       values ($1, $2, $3, $4) returning id`,
      [dto.patientId, dto.appointmentId ?? null, userId, body],
    );
    return this.get(db, spaceId, rows[0].id);
  }

  /** A correction before or after printing: the text only. */
  async update(db: Pool, spaceId: string, id: string, html: string) {
    await this.get(db, spaceId, id);
    await db.query(
      `update lab_requests set body = $2, updated_at = now() where id = $1`,
      [id, required(html)],
    );
    return this.get(db, spaceId, id);
  }

  /** Everything the printed bilan shows. */
  async print(db: Pool, spaceId: string, id: string) {
    const { rows } = await db.query(
      `select ${REQUEST},
              json_build_object('firstName', p.first_name, 'lastName', p.last_name,
                'sex', p.sex, 'birthDate', to_char(p.birth_date, 'YYYY-MM-DD'),
                'cin', p.cin, 'fileNumber', p.file_number) as patient,
              json_build_object('name', s.name, 'city', s.city, 'address', s.address,
                'phone', s.phone) as space
         from ${FROM}
         join spaces s on s.id = p.space_id
        where r.id = $1 and p.space_id = $2`,
      [id, spaceId],
    );
    if (!rows[0]) throw notFound();
    const cabinet = await db.query(
      `select name, legal_name as "legalName", specialty, address, city, phone, email
         from clinic_settings where id = 1`,
    );
    return { ...rows[0], cabinet: cabinet.rows[0] };
  }

  // ── The doctor's own bilans ──

  async models(db: Pool, userId: string) {
    const { rows } = await db.query(
      `select id, name, body from lab_request_models
        where practitioner_id = $1 order by lower(name)`,
      [userId],
    );
    return rows;
  }

  async createModel(db: Pool, userId: string, dto: LabRequestModelDto) {
    return uniqueName(() =>
      db
        .query(
          `insert into lab_request_models (practitioner_id, name, body)
           values ($1, $2, $3) returning id, name, body`,
          [userId, dto.name, required(dto.body)],
        )
        .then((r) => r.rows[0]),
    );
  }

  async updateModel(db: Pool, userId: string, id: string, dto: LabRequestModelDto) {
    const { rows } = await uniqueName(() =>
      db.query(
        `update lab_request_models set name = $3, body = $4, updated_at = now()
          where id = $1 and practitioner_id = $2 returning id, name, body`,
        [id, userId, dto.name, required(dto.body)],
      ),
    );
    if (!rows[0]) throw modelNotFound();
    return rows[0];
  }

  async deleteModel(db: Pool, userId: string, id: string) {
    const { rowCount } = await db.query(
      `delete from lab_request_models where id = $1 and practitioner_id = $2`,
      [id, userId],
    );
    if (!rowCount) throw modelNotFound();
  }

  private async get(db: Pool, spaceId: string, id: string) {
    const { rows } = await db.query(
      `select ${REQUEST} from ${FROM} where r.id = $1 and p.space_id = $2`,
      [id, spaceId],
    );
    if (!rows[0]) throw notFound();
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

/** Cleaned HTML, refused when no text is left. */
function required(html: string) {
  const body = richOrNull(html);
  if (!body) {
    throw new BadRequestException({
      code: 'LAB_REQUEST_EMPTY',
      message: 'Le bilan est vide.',
    });
  }
  return body;
}

const notFound = () =>
  new NotFoundException({
    code: 'LAB_REQUEST_NOT_FOUND',
    message: 'Bilan introuvable.',
  });

const modelNotFound = () =>
  new NotFoundException({
    code: 'LAB_REQUEST_MODEL_NOT_FOUND',
    message: 'Bilan personnalisé introuvable.',
  });

/** A doctor's bilans can't share a name (case-insensitive). */
async function uniqueName<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw new ConflictException({
        code: 'LAB_REQUEST_MODEL_NAME_TAKEN',
        message: 'Un bilan porte déjà ce nom.',
      });
    }
    throw err;
  }
}
