import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { id } from './columns.js';
import { platformUsers } from './platform-users.js';
import { tenants } from './tenants.js';

/** Who (platform user) did what, on which cabinet, when. */
export const platformAuditLogs = pgTable(
  'platform_audit_logs',
  {
    id: id(),
    userId: uuid('user_id').references(() => platformUsers.id, {
      onDelete: 'set null',
    }),
    /** The cabinet affected, if any (e.g. "tenant.suspend"). */
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'set null',
    }),
    /** e.g. "tenant.create", "tenant.suspend" */
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('platform_audit_logs_created_idx').on(t.createdAt)],
);
