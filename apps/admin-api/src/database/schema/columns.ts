import { timestamp, uuid } from 'drizzle-orm/pg-core';

// admin-api has exactly one database — the catalog. No RLS, no tenant_id:
// every row here already belongs to the platform.

/** Primary key used by every table. */
export const id = () => uuid('id').primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
