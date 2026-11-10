import type { Pool } from '@neondatabase/serverless';
import { Injectable } from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { assertOwner } from '../auth/roles.js';

/** Postgres "undefined_column": the cabinet's database isn't migrated yet. */
const UNDEFINED_COLUMN = '42703';

const isUndefinedColumn = (err: unknown) =>
  (err as { code?: string } | null)?.code === UNDEFINED_COLUMN;

/**
 * The first-sign-in product tour, remembered per account (tenant-db 0002),
 * and the getting-started checklist of the responsible doctor.
 */
@Injectable()
export class OnboardingService {
  /**
   * Whether this user has finished or skipped the tour. A cabinet whose
   * database predates the tour simply doesn't get it, instead of failing.
   */
  async tourCompleted(db: Pool, userId: string) {
    try {
      const { rows } = await db.query<{ tour_completed_at: Date | null }>(
        'select tour_completed_at from users where id = $1',
        [userId],
      );
      return rows[0]?.tour_completed_at != null;
    } catch (err) {
      if (isUndefinedColumn(err)) return true;
      throw err;
    }
  }

  async completeTour(db: Pool, userId: string) {
    try {
      await db.query(
        'update users set tour_completed_at = coalesce(tour_completed_at, now()) where id = $1',
        [userId],
      );
    } catch (err) {
      if (!isUndefinedColumn(err)) throw err;
    }
  }

  /**
   * Where the cabinet stands, read from what it really did (a patient
   * exists…). Null when hidden, or when the database predates the checklist.
   */
  async checklist(db: Pool, user: ClinicUser) {
    assertOwner(user);
    try {
      const { rows } = await db.query<{
        dismissed: boolean;
        hours: boolean;
        acts: boolean;
        team: boolean;
        patient: boolean;
        appointment: boolean;
      }>(
        `select checklist_dismissed_at is not null as dismissed,
                hours_confirmed_at is not null as hours,
                exists (select 1 from acts where active) as acts,
                exists (select 1 from users where role <> 'owner') as team,
                exists (select 1 from patients) as patient,
                exists (select 1 from appointments) as appointment
           from clinic_settings where id = 1`,
      );
      const { dismissed, ...steps } = rows[0];
      return dismissed ? null : steps;
    } catch (err) {
      if (isUndefinedColumn(err)) return null;
      throw err;
    }
  }

  /** The hours were saved, or accepted as they are. */
  async confirmHours(db: Pool) {
    await this.mark(db, 'hours_confirmed_at');
  }

  async dismissChecklist(db: Pool) {
    await this.mark(db, 'checklist_dismissed_at');
  }

  private async mark(db: Pool, column: string) {
    try {
      await db.query(
        `update clinic_settings set ${column} = coalesce(${column}, now()) where id = 1`,
      );
    } catch (err) {
      if (!isUndefinedColumn(err)) throw err;
    }
  }
}
