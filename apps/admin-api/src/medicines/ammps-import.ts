import {
  type MedicationImport,
  medicationImports,
} from '@cabinova/medicines-db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { AmmpsFile, AmmpsRow } from './ammps-file.js';
import type { MedicinesDatabase } from './medicines-db.module.js';

/**
 * Below this share of the medicines currently active, a file is refused:
 * a truncated export must never empty the list every cabinet relies on.
 */
export const MIN_SHARE_OF_ACTIVE = 0.8;
/** More unreadable lines than this share, and the file is refused too. */
export const MAX_SKIPPED_SHARE = 0.05;
/** A "running" import older than this was cut off (restart, crash). */
const STALE_AFTER_MINUTES = 15;
/** Rows per insert into the staging table (11 parameters each). */
const BATCH = 1000;

/** Another import is running: refused, nothing written. */
export class ImportBusyError extends Error {
  constructor() {
    super('Un import est déjà en cours. Réessayez dans quelques minutes.');
  }
}

export type ImportInput = {
  file: AmmpsFile;
  fileName: string;
  by?: { id: string; name: string };
};

/** Postgres "unique_violation", wherever the driver puts the code. */
const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
};

/**
 * Brings the medicines list to what the AMMPS file says, all or nothing:
 * new medicines added, changed ones updated, those no longer in the file
 * marked inactive (never deleted: old ordonnances still point at them),
 * and a deactivated one that comes back reactivated. The import's row
 * keeps what happened. Refused (and nothing written) when the file holds
 * far fewer medicines than are active, or too many lines were unreadable.
 */
export async function importAmmps(
  db: MedicinesDatabase,
  { file, fileName, by }: ImportInput,
): Promise<MedicationImport> {
  // An import cut off by a restart would otherwise block every next one.
  await db
    .update(medicationImports)
    .set({
      status: 'failed',
      error: 'Import interrompu (redémarrage du serveur).',
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(medicationImports.status, 'running'),
        lt(
          medicationImports.startedAt,
          sql`now() - make_interval(mins => ${STALE_AFTER_MINUTES})`,
        ),
      ),
    );

  let run: MedicationImport;
  try {
    [run] = await db
      .insert(medicationImports)
      .values({
        fileName,
        rowsRead: file.rows.length,
        importedBy: by?.id ?? null,
        importedByName: by?.name ?? null,
      })
      .returning();
  } catch (err) {
    if (isUniqueViolation(err)) throw new ImportBusyError();
    throw err;
  }

  const finish = async (values: Partial<MedicationImport>) => {
    const [row] = await db
      .update(medicationImports)
      .set({ ...values, finishedAt: new Date() })
      .where(eq(medicationImports.id, run.id))
      .returning();
    return row;
  };

  try {
    const refusal = await safetyCheck(db, file);
    if (refusal) return await finish({ status: 'failed', error: refusal });

    const counts = await db.transaction(async (tx) => {
      // The file, staged; then three set-based statements against it.
      await tx.execute(sql`
        create temp table ammps_rows (
          ammps_id integer primary key,
          name text not null,
          substances text not null,
          dosage text,
          form text,
          presentation text,
          lab text,
          status text,
          availability medication_availability not null,
          ppv numeric(10, 2),
          ph numeric(10, 2)
        ) on commit drop`);
      for (let i = 0; i < file.rows.length; i += BATCH) {
        const values = file.rows.slice(i, i + BATCH).map(
          (r: AmmpsRow) =>
            sql`(${r.ammpsId}, ${r.name}, ${r.substances}, ${r.dosage}, ${r.form}, ${r.presentation}, ${r.lab}, ${r.status}, ${r.availability}::medication_availability, ${r.ppv}::numeric, ${r.ph}::numeric)`,
        );
        await tx.execute(
          sql`insert into ammps_rows values ${sql.join(values, sql`, `)}`,
        );
      }

      const inserted = await tx.execute(sql`
        insert into medications
          (ammps_id, name, substances, dosage, form, presentation, lab, status, availability, ppv, ph, import_id)
        select r.ammps_id, r.name, r.substances, r.dosage, r.form, r.presentation, r.lab, r.status, r.availability, r.ppv, r.ph, ${run.id}
        from ammps_rows r
        where not exists (select 1 from medications m where m.ammps_id = r.ammps_id)`);

      // Only what really changed (or comes back) is touched: updated_at stays meaningful.
      const updated = await tx.execute(sql`
        update medications m set
          name = r.name, substances = r.substances, dosage = r.dosage, form = r.form,
          presentation = r.presentation, lab = r.lab, status = r.status,
          availability = r.availability, ppv = r.ppv, ph = r.ph,
          is_active = true, import_id = ${run.id}, updated_at = now()
        from ammps_rows r
        where m.ammps_id = r.ammps_id
          and (m.name, m.substances, m.dosage, m.form, m.presentation, m.lab, m.status, m.availability, m.ppv, m.ph, m.is_active)
            is distinct from
              (r.name, r.substances, r.dosage, r.form, r.presentation, r.lab, r.status, r.availability, r.ppv, r.ph, true)`);

      await tx.execute(sql`
        update medications m set import_id = ${run.id}
        from ammps_rows r
        where m.ammps_id = r.ammps_id and m.import_id is distinct from ${run.id}`);

      const deactivated = await tx.execute(sql`
        update medications m set is_active = false, updated_at = now()
        where m.is_active
          and not exists (select 1 from ammps_rows r where r.ammps_id = m.ammps_id)`);

      return {
        rowsInserted: inserted.rowCount ?? 0,
        rowsUpdated: updated.rowCount ?? 0,
        rowsDeactivated: deactivated.rowCount ?? 0,
      };
    });

    return await finish({ status: 'success', ...counts });
  } catch (err) {
    await finish({
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** Why the file must not be applied, or null when it may. */
async function safetyCheck(db: MedicinesDatabase, file: AmmpsFile) {
  const read = file.rows.length;
  const total = read + file.skipped.length;
  if (file.skipped.length > total * MAX_SKIPPED_SHARE) {
    return `Trop de lignes illisibles (${file.skipped.length} sur ${total}) : le format du fichier a sans doute changé. Rien n’a été modifié.`;
  }
  const {
    rows: [{ active }],
  } = await db.execute<{ active: number }>(
    sql`select count(*)::int as active from medications where is_active`,
  );
  if (active > 0 && read < Math.ceil(active * MIN_SHARE_OF_ACTIVE)) {
    return `Le fichier contient ${read} médicaments contre ${active} actifs (moins de ${Math.round(MIN_SHARE_OF_ACTIVE * 100)} %) : il est sans doute incomplet. Rien n’a été modifié.`;
  }
  return null;
}
