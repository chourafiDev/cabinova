import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import type { ClosureDto, ConflictsQuery, ListClosuresQuery } from './dto.js';

const TZ = `'Africa/Casablanca'`;
/** A year at most: longer is a mistake (or not a closure). */
const MAX_DAYS = 366;
/** Appointments that still expect the doctor. */
const ACTIVE = `('scheduled', 'confirmed', 'arrived', 'in_consultation')`;

const CLOSURE = `
  c.id, c.kind, c.practitioner_id as "practitionerId", u.name as "practitionerName",
  to_char(c.starts_on, 'YYYY-MM-DD') as "startsOn", to_char(c.ends_on, 'YYYY-MM-DD') as "endsOn",
  c.note, c.created_at as "createdAt",
  (select count(*)::int from appointments a
    where a.status in ${ACTIVE}
      and (c.practitioner_id is null or a.practitioner_id = c.practitioner_id)
      and (a.starts_at at time zone ${TZ})::date between c.starts_on and c.ends_on) as "appointments"`;

/**
 * Days off: the whole cabinet's (the responsible doctor decides) or one
 * doctor's (entered by them, the responsible doctor or the front desk).
 */
@Injectable()
export class ClosuresService {
  async list(db: Pool, query: ListClosuresQuery) {
    const params: unknown[] = [];
    let where: string;
    if (query.from && query.to) {
      params.push(query.from, query.to);
      where = 'c.ends_on >= $1::date and c.starts_on <= $2::date';
    } else if (query.when === 'past') {
      where = `c.ends_on < (now() at time zone ${TZ})::date`;
    } else {
      where = `c.ends_on >= (now() at time zone ${TZ})::date`;
    }
    const { rows } = await db.query(
      `select ${CLOSURE} from closures c left join users u on u.id = c.practitioner_id
        where ${where}
        order by c.starts_on ${query.when === 'past' ? 'desc' : 'asc'}, u.name nulls first
        limit 200`,
      params,
    );
    return rows;
  }

  /** The appointments already booked in a period: to move before (or after) closing it. */
  async conflicts(db: Pool, query: ConflictsQuery) {
    const { rows } = await db.query(
      `select a.id, a.starts_at as "startsAt", a.status,
              json_build_object('id', p.id, 'firstName', p.first_name, 'lastName', p.last_name,
                'phone', p.phone) as patient,
              json_build_object('id', u.id, 'name', u.name) as practitioner
         from appointments a
         join patients p on p.id = a.patient_id
         join users u on u.id = a.practitioner_id
        where a.status in ${ACTIVE}
          and ($3::uuid is null or a.practitioner_id = $3)
          and (a.starts_at at time zone ${TZ})::date between $1::date and $2::date
        order by a.starts_at
        limit 100`,
      [query.from, query.to, query.practitionerId ?? null],
    );
    return rows;
  }

  async create(db: Pool, dto: ClosureDto, user: ClinicUser) {
    const practitionerId = dto.practitionerId ?? null;
    this.assertAllowed(user, practitionerId);
    const days =
      (Date.parse(dto.endsOn) - Date.parse(dto.startsOn)) / 86_400_000 + 1;
    if (!(days >= 1)) {
      throw new BadRequestException({
        code: 'CLOSURE_DATES',
        message: 'La date de fin doit suivre la date de début.',
      });
    }
    if (days > MAX_DAYS) {
      throw new BadRequestException({
        code: 'CLOSURE_TOO_LONG',
        message: 'Une absence dure un an au plus.',
      });
    }
    if (practitionerId) {
      const { rowCount } = await db.query(
        `select 1 from users where id = $1 and active and role in ('owner', 'doctor')`,
        [practitionerId],
      );
      if (!rowCount) {
        throw new BadRequestException({
          code: 'PRACTITIONER_UNAVAILABLE',
          message: 'Ce médecin ne fait pas partie du cabinet.',
        });
      }
    }
    const { rows } = await db.query<{ id: string }>(
      `insert into closures (practitioner_id, kind, starts_on, ends_on, note, created_by)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [
        practitionerId,
        dto.kind,
        dto.startsOn,
        dto.endsOn,
        dto.note ?? null,
        user.id,
      ],
    );
    return this.find(db, rows[0].id);
  }

  async remove(db: Pool, id: string, user: ClinicUser) {
    const closure = await this.find(db, id);
    this.assertAllowed(user, closure.practitionerId);
    await db.query('delete from closures where id = $1', [id]);
    return closure;
  }

  private async find(db: Pool, id: string) {
    const { rows } = await db.query<{
      id: string;
      practitionerId: string | null;
    }>(
      `select ${CLOSURE} from closures c left join users u on u.id = c.practitioner_id
        where c.id = $1`,
      [id],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'CLOSURE_NOT_FOUND',
        message: 'Absence introuvable.',
      });
    }
    return rows[0];
  }

  /**
   * The whole cabinet: the responsible doctor. A doctor's days: that doctor,
   * the responsible doctor, or the front desk (who keeps the planning).
   */
  private assertAllowed(user: ClinicUser, practitionerId: string | null) {
    const allowed =
      user.role === 'owner' ||
      (practitionerId !== null &&
        (user.role === 'secretary' || user.id === practitionerId));
    if (!allowed) {
      throw new ForbiddenException({
        code: practitionerId ? 'CLOSURE_NOT_YOURS' : 'OWNER_ONLY',
        message: practitionerId
          ? 'Vous ne pouvez gérer que vos propres absences.'
          : 'Seul le médecin responsable ferme le cabinet.',
      });
    }
  }
}
