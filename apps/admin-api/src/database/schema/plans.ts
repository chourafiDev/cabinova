import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  index,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { PlanFeatures } from '../../plans/catalog.js';
import { id, timestamps } from './columns.js';
import { platformUsers } from './platform-users.js';
import { tenants } from './tenants.js';

// Module 3 — Abonnements et facturation. Payment is by bank transfer to the
// platform's RIB: invoices are issued automatically (trial end, renewals),
// and an admin records each transfer when it reaches the bank account.

export const billingPeriod = pgEnum('billing_period', ['monthly', 'annual']);

/**
 * trialing  — free trial, no invoice yet
 * active    — paid up to current_period_end
 * past_due  — an invoice is waiting for its transfer (trial ended or
 *             period ended without payment)
 * cancelled — ended (résiliation or closed cabinet)
 */
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
  /** Cancelled by an admin (wrong amount…); kept for the numbering trail. */
  'void',
]);

/** Invoice numbers: F-<year>-<6 digits>, never reused. */
export const invoiceNumberSeq = pgSequence('invoice_number_seq');

export const subscriptionPlans = pgTable('subscription_plans', {
  id: id(),
  /** "starter" | "pro" | "enterprise" — stable, used in code. */
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  /** Smallest currency unit (centimes), MAD. */
  priceMonthly: integer('price_monthly').notNull(),
  priceAnnual: integer('price_annual').notNull(),
  trialDays: integer('trial_days').notNull().default(7),
  maxDoctors: integer('max_doctors'),
  maxSecretaries: integer('max_secretaries'),
  maxUsers: integer('max_users'),
  storageQuotaMb: integer('storage_quota_mb'),
  /** Level of every catalog feature, e.g. { sms_reminders: "limited" }. */
  features: jsonb('features').$type<PlanFeatures>().notNull(),
  /** Archived plans stay attached to existing cabinets but can't be picked. */
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
    billingPeriod: billingPeriod('billing_period').notNull().default('monthly'),
    /**
     * Price per billing period (centimes), copied from the plan when the
     * subscription starts: later price changes don't affect it.
     */
    price: integer('price').notNull(),
    /** Commercial discount applied to each invoice, 0–100 %. */
    discountPercent: integer('discount_percent').notNull().default(0),
    /** Résiliation at term: no new invoice, ends at current_period_end. */
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    status: subscriptionStatus('status').notNull().default('trialing'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // One live subscription per cabinet; cancelled ones are history.
    uniqueIndex('subscriptions_one_live_idx')
      .on(t.tenantId)
      .where(sql`${t.status} <> 'cancelled'`),
  ],
);

/**
 * Amount billed vs. collected is tracked explicitly (never merged into one
 * KPI — see the dashboard spec): `status` distinguishes billed/paid/overdue.
 */
export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    /** e.g. "F-2026-000042" — also the reference to write on the transfer. */
    number: text('number').notNull().unique(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),
    /** e.g. "Offre Pro — mensuel, du 01/11/2026 au 01/12/2026" */
    description: text('description').notNull(),
    /** Smallest currency unit (centimes), after discount. */
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('MAD'),
    status: invoiceStatus('status').notNull().default('billed'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Unpaid after this date → overdue. */
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('invoices_tenant_idx').on(t.tenantId, t.issuedAt),
    index('invoices_status_idx').on(t.status, t.dueAt),
  ],
);

/** A bank transfer received for an invoice, recorded by an admin. */
export const invoicePayments = pgTable('invoice_payments', {
  id: id(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  /** Centimes actually received. */
  amount: integer('amount').notNull(),
  /** Date the transfer reached the account (from the bank statement). */
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  method: text('method').notNull().default('bank_transfer'),
  /** Bank reference / transfer label, to reconcile with the statement. */
  reference: text('reference'),
  note: text('note'),
  recordedBy: uuid('recorded_by').references(() => platformUsers.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
