import type { Pool } from '@neondatabase/serverless';

/**
 * A patient who never came: once the appointment's day is over (Moroccan
 * time), a visit still "Planifié" or "Confirmé" becomes "Absent". The desk
 * can still change it by hand if the patient did come. No notification:
 * nobody did anything. Returns how many visits changed.
 */
export async function markMissedVisits(db: Pool): Promise<number> {
  const { rowCount } = await db.query(
    `update appointments set status = 'no_show', updated_at = now()
      where status in ('scheduled', 'confirmed')
        and (starts_at at time zone 'Africa/Casablanca')::date
          < (now() at time zone 'Africa/Casablanca')::date`,
  );
  return rowCount ?? 0;
}
