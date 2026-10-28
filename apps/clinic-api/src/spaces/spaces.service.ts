import type { Pool } from '@neondatabase/serverless';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';

export type Space = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
};

const COLUMNS = 'id, name, city, address, phone';

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
            `select ${COLUMNS} from spaces where active order by created_at, name`,
          )
        : await db.query<Space>(
            `select s.id, s.name, s.city, s.address, s.phone from spaces s
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
  async create(
    db: Pool,
    user: ClinicUser,
    dto: {
      name: string;
      city?: string | null;
      address?: string | null;
      phone?: string | null;
    },
  ) {
    if (user.role !== 'owner') {
      throw new ForbiddenException({
        code: 'OWNER_ONLY',
        message: 'Seul le médecin responsable crée des espaces.',
      });
    }
    const { rows } = await db.query<{ id: string }>(
      `insert into spaces (name, city, address, phone) values ($1, $2, $3, $4) returning id`,
      [dto.name, dto.city ?? null, dto.address ?? null, dto.phone ?? null],
    );
    return this.switchTo(db, user, rows[0].id);
  }

  private notFound() {
    return new NotFoundException({
      code: 'SPACE_NOT_FOUND',
      message: 'Espace introuvable.',
    });
  }
}
