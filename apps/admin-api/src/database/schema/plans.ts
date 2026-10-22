import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.js';
import { tenants } from './tenants.js';

// Module 3 — Abonnements et facturation.

export const billingPeriod = pgEnum('billing_period', ['monthly', 'annual']);

export const subscriptionStatus = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'cancelled',
]);

export const invoiceStatus = pgEnum('invoice_status', [
  'billed',
  'paid',
  'overdue',
  'refunded',
]);

export const subscriptionPlans = pgTable('subscription_plans', {
  id: id(),
  /** "starter" | "pro" | "enterprise" — stable, used in code. */
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  /** Smallest currency unit (centimes), MAD. */
  priceMonthly: integer('price_monthly').notNull(),
  priceAnnual: integer('price_annual').notNull(),
  trialDays: integer('trial_days').notNull().default(7),
  maxDoctors: integer('max_doctors'),
  maxSecretaries: integer('max_secretaries'),
  maxUsers: integer('max_users'),
  storageQuotaMb: integer('storage_quota_mb'),
  /** Feature keys included/limited for this plan, e.g. { smsReminders: "limited" }. */
  features: jsonb('features').notNull().default({}),
  ...timestamps,
});

export const subscriptions = pgTable('subscriptions', {
  id: id(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id')
    .notNull()
    .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
  billingPeriod: billingPeriod('billing_period').notNull().default('monthly'),
  status: subscriptionStatus('status').notNull().default('trialing'),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  ...timestamps,
});

/**
 * Amount billed vs. collected is tracked explicitly (never merged into one
 * KPI — see the dashboard spec): `status` distinguishes billed/paid/overdue.
 */
export const invoices = pgTable('invoices', {
  id: id(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
    onDelete: 'set null',
  }),
  /** Smallest currency unit (centimes). */
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('MAD'),
  status: invoiceStatus('status').notNull().default('billed'),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  ...timestamps,
});
