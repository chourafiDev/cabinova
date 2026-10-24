import type { Transaction } from '../database/database.module.js';
import { platformAuditLogs } from '../database/schema/index.js';

/** Who triggered an audited change: a platform user, or the platform itself. */
export type AuditActor = { userId: string | null; ip?: string | null };

/** Writes one platform audit entry inside the caller's transaction. */
export async function writeAudit(
  tx: Transaction,
  actor: AuditActor,
  entry: {
    /** e.g. "plan.update" */
    action: string;
    entity: string;
    entityId: string;
    /** The cabinet affected, if any. */
    tenantId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.insert(platformAuditLogs).values({
    userId: actor.userId,
    tenantId: entry.tenantId ?? null,
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    metadata: entry.metadata,
    ip: actor.ip ?? null,
  });
}

/** Field-by-field diff of `next` against `current`, for audit metadata. */
export function diff<T extends Record<string, unknown>>(
  current: T,
  next: Partial<T>,
  keys: readonly (keyof T & string)[],
) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    const value = next[key];
    if (value !== undefined && !sameValue(value, current[key])) {
      changes[key] = { from: current[key], to: value };
    }
  }
  return changes;
}

/**
 * Equality for column values: scalars, or JSON objects such as plan
 * features, compared by content regardless of key order (jsonb reorders
 * keys).
 */
const sameValue = (a: unknown, b: unknown) =>
  typeof a === 'object' && a !== null ? canonical(a) === canonical(b) : a === b;

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([x], [y]) => x.localeCompare(y)),
        )
      : v,
  );
