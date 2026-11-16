import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { richOrNull } from '../common/rich-text.js';
import type { LetterDto, LetterKind } from './dto.js';

const REQUEST = `
  r.id, r.kind, r.body, r.appointment_id as "appointmentId", r.created_at as "createdAt",
  r.updated_at as "updatedAt", r.practitioner_id as "practitionerId", u.name as practitioner`;
const FROM = `letters r
  join patients p on p.id = r.patient_id
  left join users u on u.id = r.practitioner_id`;

/**
 * Lettres and comptes rendus (doctors write them, the whole staff prints
 * them), on the cabinet's letterhead.
 */
@Injectable()
export class LettersService {
  /** The patient's letters (or comptes rendus) in this space, newest first. */
  async list(db: Pool, spaceId: string, patientId: string, kind: LetterKind) {
    await this.patient(db, spaceId, patientId);
    const { rows } = await db.query(
      `select ${REQUEST} from ${FROM}
        where r.patient_id = $1 and p.space_id = $2 and r.kind = $3
        order by r.created_at desc`,
      [patientId, spaceId, kind],
    );
    return rows;
  }

  async create(db: Pool, spaceId: string, dto: LetterDto, userId: string) {
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
      `insert into letters (patient_id, appointment_id, practitioner_id, kind, body)
       values ($1, $2, $3, $4, $5) returning id`,
      [dto.patientId, dto.appointmentId ?? null, userId, dto.kind ?? 'letter', body],
    );
    return this.get(db, spaceId, rows[0].id);
  }

  /** A correction before or after printing: the text only. */
  async update(db: Pool, spaceId: string, id: string, html: string) {
    await this.get(db, spaceId, id);
    await db.query(
      `update letters set body = $2, updated_at = now() where id = $1`,
      [id, required(html)],
    );
    return this.get(db, spaceId, id);
  }

  /** Everything the printed letter shows. */
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
      code: 'LETTER_EMPTY',
      message: 'La lettre est vide.',
    });
  }
  return body;
}

const notFound = () =>
  new NotFoundException({
    code: 'LETTER_NOT_FOUND',
    message: 'Lettre introuvable.',
  });
