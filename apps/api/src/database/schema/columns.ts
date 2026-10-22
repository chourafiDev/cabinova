import { sql } from 'drizzle-orm';
import { pgPolicy, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Primary key used by every table. */
export const id = () => uuid('id').primaryKey().defaultRandom();

/** Owner tenant: required on every tenant-scoped table (RLS filters on it). */
export const tenantId = () => uuid('tenant_id').notNull();

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * The tenant of the current transaction, set by DatabaseService.withTenant().
 * NULL when unset, so a query outside withTenant() sees no rows.
 */
const currentTenant = sql`nullif(current_setting('app.tenant_id', true), '')::uuid`;

/**
 * RLS policy for tenant-scoped tables: rows are visible and writable only
 * inside withTenant() for their own tenant. Adding it enables RLS on the
 * table; FORCE (so the owner role is also bound) is set in a custom migration.
 */
export const tenantIsolation = () =>
  pgPolicy('tenant_isolation', {
    for: 'all',
    using: sql`tenant_id = ${currentTenant}`,
    withCheck: sql`tenant_id = ${currentTenant}`,
  });
