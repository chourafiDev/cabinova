import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import type { CertificateDto, CertificateModelDto } from './dto.js';

/**
 * What a certificate may hold: the editor's formatting, nothing else (it is
 * printed as HTML, so no scripts, links or images get through).
 */
export function cleanBody(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li'],
    allowedAttributes: { p: ['style'], li: ['style'] },
    allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/] } },
  }).trim();
}

/** Text left once the tags are gone: an empty editor gives "<p></p>". */
const isEmpty = (html: string) =>
  sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim() === '';

const CERTIFICATE = `
  c.id, c.kind, to_char(c.starts_on, 'YYYY-MM-DD') as "startsOn",
  to_char(c.ends_on, 'YYYY-MM-DD') as "endsOn", c.body,
  c.appointment_id as "appointmentId", c.created_at as "createdAt",
  c.practitioner_id as "practitionerId", u.name as practitioner,
  c.cancelled_at as "cancelledAt", cu.name as "cancelledBy"`;
const FROM = `certificates c
  join patients p on p.id = c.patient_id
  left join users u on u.id = c.practitioner_id
  left join users cu on cu.id = c.cancelled_by`;

/**
 * Medical certificates (doctors only): given once, printed on the cabinet's
 * letterhead, cancelled rather than changed. The doctors' own models too.
 */
@Injectable()
export class CertificatesService {
  /** The patient's certificates in this space, newest first. */
  async list(db: Pool, spaceId: string, patientId: string) {
    await this.patient(db, spaceId, patientId);
    const { rows } = await db.query(
      `select ${CERTIFICATE} from ${FROM}
        where c.patient_id = $1 and p.space_id = $2
        order by c.created_at desc`,
      [patientId, spaceId],
    );
    return rows;
  }

  async create(db: Pool, spaceId: string, dto: CertificateDto, userId: string) {
    const patient = await this.patient(db, spaceId, dto.patientId);
    if (patient.archived) {
      throw new ConflictException({
        code: 'PATIENT_ARCHIVED',
        message: 'Ce dossier est archivé.',
      });
    }
    const endsOn = dto.kind === 'period' ? (dto.endsOn ?? null) : null;
    if (dto.kind === 'period' && (!endsOn || endsOn < dto.startsOn)) {
      throw new BadRequestException({
        code: 'CERTIFICATE_DATES',
        message: 'La fin de la période doit suivre son début.',
      });
    }
    const body = cleanBody(dto.body);
    if (isEmpty(body)) {
      throw new BadRequestException({
        code: 'CERTIFICATE_EMPTY',
        message: 'Le certificat est vide.',
      });
    }
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
      `insert into certificates
         (patient_id, appointment_id, practitioner_id, kind, starts_on, ends_on, body)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [dto.patientId, dto.appointmentId ?? null, userId, dto.kind, dto.startsOn, endsOn, body],
    );
    return this.get(db, spaceId, rows[0].id);
  }

  /** Cancelled, not deleted: it stays in the history, and can't be printed again. */
  async cancel(db: Pool, spaceId: string, id: string, userId: string) {
    const certificate = await this.get(db, spaceId, id);
    if (certificate.cancelledAt) throw cancelled();
    await db.query(
      `update certificates set cancelled_at = now(), cancelled_by = $2, updated_at = now()
        where id = $1`,
      [id, userId],
    );
    return this.get(db, spaceId, id);
  }

  /** Everything the printed certificate shows. */
  async print(db: Pool, spaceId: string, id: string) {
    const { rows } = await db.query(
      `select ${CERTIFICATE},
              json_build_object('firstName', p.first_name, 'lastName', p.last_name,
                'sex', p.sex, 'birthDate', to_char(p.birth_date, 'YYYY-MM-DD'),
                'cin', p.cin, 'fileNumber', p.file_number) as patient,
              json_build_object('name', s.name, 'city', s.city, 'address', s.address,
                'phone', s.phone) as space
         from ${FROM}
         join spaces s on s.id = p.space_id
        where c.id = $1 and p.space_id = $2`,
      [id, spaceId],
    );
    if (!rows[0]) throw notFound();
    if (rows[0].cancelledAt) throw cancelled();
    const cabinet = await db.query(
      `select name, legal_name as "legalName", specialty, address, city, phone, email
         from clinic_settings where id = 1`,
    );
    return { ...rows[0], cabinet: cabinet.rows[0] };
  }

  // ── The doctor's models ──

  async models(db: Pool, userId: string) {
    const { rows } = await db.query(
      `select id, name, body from certificate_models
        where practitioner_id = $1 order by lower(name)`,
      [userId],
    );
    return rows;
  }

  async createModel(db: Pool, userId: string, dto: CertificateModelDto) {
    return uniqueName(() =>
      db
        .query(
          `insert into certificate_models (practitioner_id, name, body)
           values ($1, $2, $3) returning id, name, body`,
          [userId, dto.name, cleanBody(dto.body)],
        )
        .then((r) => r.rows[0]),
    );
  }

  async updateModel(db: Pool, userId: string, id: string, dto: CertificateModelDto) {
    const { rows } = await uniqueName(() =>
      db.query(
        `update certificate_models set name = $3, body = $4, updated_at = now()
          where id = $1 and practitioner_id = $2 returning id, name, body`,
        [id, userId, dto.name, cleanBody(dto.body)],
      ),
    );
    if (!rows[0]) throw modelNotFound();
    return rows[0];
  }

  async deleteModel(db: Pool, userId: string, id: string) {
    const { rowCount } = await db.query(
      `delete from certificate_models where id = $1 and practitioner_id = $2`,
      [id, userId],
    );
    if (!rowCount) throw modelNotFound();
  }

  private async get(db: Pool, spaceId: string, id: string) {
    const { rows } = await db.query(
      `select ${CERTIFICATE} from ${FROM} where c.id = $1 and p.space_id = $2`,
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

const notFound = () =>
  new NotFoundException({
    code: 'CERTIFICATE_NOT_FOUND',
    message: 'Certificat introuvable.',
  });

const cancelled = () =>
  new ConflictException({
    code: 'CERTIFICATE_CANCELLED',
    message: 'Ce certificat a été annulé.',
  });

const modelNotFound = () =>
  new NotFoundException({
    code: 'CERTIFICATE_MODEL_NOT_FOUND',
    message: 'Modèle introuvable.',
  });

/** A doctor's models can't share a name (case-insensitive). */
async function uniqueName<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw new ConflictException({
        code: 'CERTIFICATE_MODEL_NAME_TAKEN',
        message: 'Un modèle porte déjà ce nom.',
      });
    }
    throw err;
  }
}
