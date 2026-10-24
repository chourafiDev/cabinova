import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.js';
import { platformUsers } from './platform-users.js';
import { tenants } from './tenants.js';

// "Fonctionnalités et options" — the feature catalog and per-cabinet
// exceptions. A plan says which level each feature has (plans.features);
// an exception overrides it for one cabinet, optionally for a period.

/**
 * active   — available according to plans and exceptions
 * beta     — only for cabinets given an exception (testers), whatever the plan
 * disabled — switched off everywhere (incident), whatever plans and exceptions say
 */
export const featureStatus = pgEnum('feature_status', [
  'active',
  'beta',
  'disabled',
]);

export const featureLevel = pgEnum('feature_level', [
  'included',
  'limited',
  'addon',
  'custom',
  'none',
]);

export const features = pgTable('features', {
  /** Stable code identifier the clinic app checks, e.g. "sms_reminders". */
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  status: featureStatus('status').notNull().default('active'),
  /** Why it was switched off (shown to admins and in the audit log). */
  disabledReason: text('disabled_reason'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

/** One cabinet's exception to its plan for one feature. */
export const tenantFeatureOverrides = pgTable(
  'tenant_feature_overrides',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    featureKey: text('feature_key')
      .notNull()
      .references(() => features.key, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    level: featureLevel('level').notNull(),
    /** Access window; NULL = from now / no end. */
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    note: text('note'),
    createdBy: uuid('created_by').references(() => platformUsers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('tenant_feature_overrides_unique_idx').on(
      t.tenantId,
      t.featureKey,
    ),
    index('tenant_feature_overrides_feature_idx').on(t.featureKey),
  ],
);
