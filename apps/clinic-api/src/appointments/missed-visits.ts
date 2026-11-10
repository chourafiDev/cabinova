import type { Pool } from '@neondatabase/serverless';

/**
 * Once the appointment's day is over (Moroccan time), a visit nobody moved
 * on is closed: "Confirmé" becomes "Absent" (the patient said they'd come),
 * "Planifié" becomes "Annulé" (never confirmed). The desk can still change
 * either by hand. No notification: nobody did anything. Returns how many
 * visits changed.
 */
export async function markMissedVisits(db: Pool): Promise<number> {
  const { rowCount } = await db.query(
    `update appointments
        set status = case status when 'confirmed' then 'no_show'::appointment_status
                                 else 'cancelled'::appointment_status end,
            updated_at = now()
      where status in ('scheduled', 'confirmed')
        and (starts_at at time zone 'Africa/Casablanca')::date
          < (now() at time zone 'Africa/Casablanca')::date`,
  );
  return rowCount ?? 0;
}
