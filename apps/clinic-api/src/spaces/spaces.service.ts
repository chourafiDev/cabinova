import type { Pool } from '@neondatabase/serverless';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { assertOwner } from '../auth/roles.js';
import {
  type OpeningHours,
  parseOpeningHours,
} from '../settings/opening-hours.js';

export type Space = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  openingHours: OpeningHours;
};

/** A space's columns, optionally prefixed by a table alias ("s."). */
const columns = (t = '') =>
  `${t}id, ${t}name, ${t}city, ${t}address, ${t}phone, ${t}opening_hours as "openingHours"`;

type SpaceFields = {
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
};

/**
 * A cabinet's spaces (branches). Isolated from one another: staff work in
 * the spaces they're members of; the owner works in all of them. Each
 * person's current space is remembered on their account.
 */
@Injectable()
export class SpacesService {
  /** Spaces this person may enter, oldest first. */
  async accessible(db: Pool, user: ClinicUser): Promise<Space[]> {
    const { rows } =
      user.role === 'owner'
        ? await db.query<Space>(
            `select ${columns()} from spaces where active order by created_at, name`,
          )
        : await db.query<Space>(
            `select ${columns('s.')} from spaces s
               join space_members m on m.space_id = s.id and m.user_id = $1
              where s.active order by s.created_at, s.name`,
            [user.id],
          );
    return rows;
  }

  /** The space this person works in now: the last one used, else the first. */
  async current(db: Pool, user: ClinicUser) {
    const spaces = await this.accessible(db, user);
    const { rows } = await db.query<{ last_space_id: string | null }>(
      'select last_space_id from users where id = $1',
      [user.id],
    );
    const current =
      spaces.find((s) => s.id === rows[0]?.last_space_id) ?? spaces[0];
    if (!current) {
      throw new ForbiddenException({
        code: 'NO_SPACE',
        message:
          'Vous n’êtes affecté(e) à aucun espace. Demandez au médecin responsable de vous y ajouter.',
      });
    }
    return { current, spaces };
  }

  async switchTo(db: Pool, user: ClinicUser, spaceId: string) {
    const spaces = await this.accessible(db, user);
    if (!spaces.some((s) => s.id === spaceId)) throw this.notFound();
    await db.query('update users set last_space_id = $2 where id = $1', [
      user.id,
      spaceId,
    ]);
    return this.current(db, user);
  }

  /** Owner only: a new space (branch); the owner switches to it. */
  async create(db: Pool, user: ClinicUser, dto: SpaceFields) {
    assertOwner(user);
    const { rows } = await db.query<{ id: string }>(
      `insert into spaces (name, city, address, phone) values ($1, $2, $3, $4) returning id`,
      [dto.name, dto.city ?? null, dto.address ?? null, dto.phone ?? null],
    );
    return this.switchTo(db, user, rows[0].id);
  }

  /**
   * Owner only (Paramètres › Espaces): every space, closed ones included,
   * with what each holds.
   */
  async manage(db: Pool, user: ClinicUser) {
    assertOwner(user);
    const { rows } = await db.query<
      Space & {
        active: boolean;
        patients: number;
        upcomingAppointments: number;
        members: number;
      }
    >(
      `select ${columns('s.')}, s.active,
              (select count(*)::int from patients p
                where p.space_id = s.id and p.archived_at is null) as patients,
              (select count(*)::int from appointments a
                where a.space_id = s.id and a.starts_at >= now()
                  and a.status not in ('cancelled', 'no_show')) as "upcomingAppointments",
              (select count(*)::int from space_members m
                where m.space_id = s.id) as members
         from spaces s order by s.active desc, s.created_at, s.name`,
    );
    return rows;
  }

  async update(db: Pool, user: ClinicUser, id: string, dto: SpaceFields) {
    assertOwner(user);
    const { rowCount } = await db.query(
      `update spaces set name = $2, city = $3, address = $4, phone = $5,
              updated_at = now() where id = $1`,
      [id, dto.name, dto.city ?? null, dto.address ?? null, dto.phone ?? null],
    );
    if (!rowCount) throw this.notFound();
    return this.find(db, id);
  }

  async setOpeningHours(
    db: Pool,
    user: ClinicUser,
    id: string,
    openingHours: unknown,
  ) {
    assertOwner(user);
    const { rowCount } = await db.query(
      `update spaces set opening_hours = $2, updated_at = now() where id = $1`,
      [id, JSON.stringify(parseOpeningHours(openingHours))],
    );
    if (!rowCount) throw this.notFound();
    return this.find(db, id);
  }

  /**
   * Closing keeps the data; nobody works there any more (people who were in
   * it land in their next space). A cabinet always keeps one open space.
   */
  async setActive(db: Pool, user: ClinicUser, id: string, active: boolean) {
    assertOwner(user);
    const client = await db.connect();
    try {
      await client.query('begin');
      // Serializes concurrent closings, so two can't leave zero open spaces.
      await client.query('lock table spaces in share row exclusive mode');
      const { rows } = await client.query<{ active: boolean }>(
        'select active from spaces where id = $1',
        [id],
      );
      if (!rows[0]) throw this.notFound();
      if (!active && rows[0].active) {
        const { rows: open } = await client.query<{ n: number }>(
          'select count(*)::int as n from spaces where active',
        );
        if (open[0].n <= 1) {
          throw new ConflictException({
            code: 'LAST_SPACE',
            message: 'Le cabinet doit garder au moins un espace ouvert.',
          });
        }
      }
      await client.query(
        'update spaces set active = $2, updated_at = now() where id = $1',
        [id, active],
      );
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
    return this.find(db, id);
  }

  private async find(db: Pool, id: string) {
    const { rows } = await db.query<Space & { active: boolean }>(
      `select ${columns()}, active from spaces where id = $1`,
      [id],
    );
    if (!rows[0]) throw this.notFound();
    return rows[0];
  }

  private notFound() {
    return new NotFoundException({
      code: 'SPACE_NOT_FOUND',
      message: 'Espace introuvable.',
    });
  }
}
