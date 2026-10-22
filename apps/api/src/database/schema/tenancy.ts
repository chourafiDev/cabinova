import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, tenantId, tenantIsolation } from './columns.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

// Per-clinic utility tables (RLS).

const tenantRef = () =>
  tenantId().references(() => tenants.id, { onDelete: 'cascade' });

/** Sequential numbers per clinic: patient file numbers, invoice numbers… */
export const tenantCounters = pgTable(
  'tenant_counters',
  {
    tenantId: tenantRef(),
    key: text('key').notNull(),
    value: integer('value').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] }), tenantIsolation()],
);

/** Who did what, on which record (cahier des charges: journal d'audit du tenant). */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** e.g. "patient.create", "patient.archive" */
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id'),
    /** Changed field names, never their (possibly medical) values. */
    metadata: jsonb('metadata'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [tenantIsolation()],
);
