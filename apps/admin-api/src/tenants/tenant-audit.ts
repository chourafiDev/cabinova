import { type AuditActor, writeAudit } from '../audit/audit.js';
import type { Transaction } from '../database/database.module.js';

export type { AuditActor };

/** Writes one cabinet audit entry inside the caller's transaction. */
export function auditTenant(
  tx: Transaction,
  actor: AuditActor,
  entry: {
    /** e.g. "tenant.update", "tenant.status.apply" */
    action: string;
    tenantId: string;
    metadata?: Record<string, unknown>;
  },
) {
  return writeAudit(tx, actor, {
    ...entry,
    entity: 'tenant',
    entityId: entry.tenantId,
  });
}
