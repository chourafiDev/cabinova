import type { AuthUser } from '../auth/auth.types.js';
import type { Transaction } from '../database/database.module.js';
import { auditLogs } from '../database/schema/index.js';

/**
 * Writes an audit entry in the same transaction as the change it describes.
 * `metadata` must not contain medical values: field names, ids, counts only.
 */
export async function audit(
  tx: Transaction,
  user: AuthUser,
  entry: {
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.insert(auditLogs).values({
    tenantId: user.tenantId,
    userId: user.id,
    ...entry,
  });
}
