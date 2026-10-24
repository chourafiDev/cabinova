import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { platformUsers } from './platform-users.js';

/**
 * Platform-wide settings, one JSON value per key (e.g. "billing": the RIB
 * printed on invoices). Read through typed accessors, never ad hoc.
 */
export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => platformUsers.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
