import { sql } from 'drizzle-orm';
import type { Transaction } from '../database/database.module.js';
import { tenantCounters } from '../database/schema/index.js';
import { currentTenant } from '../tenancy/tenant-context.js';

/**
 * Next number of a per-clinic sequence (1, 2, 3…). The upsert locks the
 * counter row until the transaction ends, so concurrent calls never collide.
 */
export async function nextNumber(tx: Transaction, key: string) {
  const [row] = await tx
    .insert(tenantCounters)
    .values({ tenantId: currentTenant().id, key, value: 1 })
    .onConflictDoUpdate({
      target: [tenantCounters.tenantId, tenantCounters.key],
      set: { value: sql`${tenantCounters.value} + 1` },
    })
    .returning({ value: tenantCounters.value });
  return row.value;
}
