import type { Pool } from '@neondatabase/serverless';
import { Injectable } from '@nestjs/common';

/** Postgres "undefined_column": the cabinet's database isn't migrated yet. */
const UNDEFINED_COLUMN = '42703';

const isUndefinedColumn = (err: unknown) =>
  (err as { code?: string } | null)?.code === UNDEFINED_COLUMN;

/** The first-sign-in product tour, remembered per account (tenant-db 0002). */
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
}
