import { FEATURES } from '@cabinova/features';
import { sql } from 'drizzle-orm';
import { type AuditActor, writeAudit } from '../audit/audit.js';
import type { Database } from '../database/database.module.js';
import { features } from '../database/schema/index.js';

const SYSTEM: AuditActor = { userId: null };

/**
 * Makes the catalog follow the code (@cabinova/features): adds features the
 * code now implements (active, but at level "none" in every plan until the
 * admin includes them), and refreshes name, category, description and order.
 * Status, plan levels and exceptions stay as the admin set them. Features no
 * longer in the code are kept and reported (shown "Absente du code").
 * Idempotent: runs at every API start, i.e. on every deploy, and in the seed.
 */
export async function syncFeatureCatalog(db: Database) {
  const before = await db.select({ key: features.key }).from(features);
  const known = new Set(before.map((f) => f.key));
  const rows = FEATURES.map((f, i) => ({
    key: f.key,
    name: f.name,
    category: f.category,
    description: f.description,
    sortOrder: i + 1,
  }));
  await db
    .insert(features)
    .values(rows)
    .onConflictDoUpdate({
      target: features.key,
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        description: sql`excluded.description`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
  const added = rows.filter((r) => !known.has(r.key)).map((r) => r.key);
  if (added.length) {
    await writeAudit(db, SYSTEM, {
      action: 'feature.sync.added',
      entity: 'feature',
      entityId: null,
      metadata: { features: added },
    });
  }
  const inCode = new Set<string>(rows.map((r) => r.key));
  const notInCode = before.map((f) => f.key).filter((k) => !inCode.has(k));
  return { total: rows.length, added, notInCode };
}
