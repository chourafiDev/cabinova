import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { id } from './columns.js';
import { platformUsers } from './platform-users.js';
import { tenants } from './tenants.js';

// In-app notifications for platform users (the bell). One row per
// recipient, so read state is personal; pushed live over SSE and kept here
// so nothing is lost while someone is offline.

export const notificationSeverity = pgEnum('notification_severity', [
  'critical',
  'warning',
  'info',
  'success',
]);

export const platformNotifications = pgTable(
  'platform_notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => platformUsers.id, { onDelete: 'cascade' }),
    /** e.g. "support.ticket.assigned" — groups and filters notifications. */
    kind: text('kind').notNull(),
    severity: notificationSeverity('severity').notNull().default('info'),
    title: text('title').notNull(),
    body: text('body'),
    /** Admin page to open, e.g. "/support/…". */
    href: text('href'),
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade',
    }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('platform_notifications_user_idx').on(t.userId, t.createdAt)],
);
