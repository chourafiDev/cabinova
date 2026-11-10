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

/**
 * pending — waiting for the transfer and its proof of payment
 * paid    — payment confirmed: the facture exists and the plan runs
 * void    — replaced by a newer devis, or cancelled by an admin
 */
export const quoteStatus = pgEnum('quote_status', ['pending', 'paid', 'void']);

/** Invoice numbers: F-<year>-<6 digits>, never reused. */
export const invoiceNumberSeq = pgSequence('invoice_number_seq');

/** Devis numbers: D-<year>-<6 digits>, never reused. */
export const quoteNumberSeq = pgSequence('quote_number_seq');

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

/**
 * Codes promo: a percentage off for a number of invoices (or all), limited
 * in time and uses, optionally to some plans. One use per cabinet.
 */
export const promoCodes = pgTable('promo_codes', {
  id: id(),
  /** Upper-case, e.g. "LANCEMENT2026". */
  code: text('code').notNull().unique(),
  description: text('description'),
  discountPercent: integer('discount_percent').notNull(),
  /** Invoices discounted per cabinet; NULL = for the whole subscription. */
  durationInvoices: integer('duration_invoices'),
  /** Plan keys it applies to; empty = all plans. */
  planKeys: jsonb('plan_keys').$type<string[]>().notNull().default([]),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  /** NULL = unlimited. */
  maxRedemptions: integer('max_redemptions'),
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by').references(() => platformUsers.id, {
    onDelete: 'set null',
  }),
  ...timestamps,
});

export const promoRedemptions = pgTable(
  'promo_redemptions',
  {
    id: id(),
    promoCodeId: uuid('promo_code_id')
      .notNull()
      .references(() => promoCodes.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, {
      onDelete: 'set null',
    }),
    redeemedBy: uuid('redeemed_by').references(() => platformUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('promo_redemptions_one_per_tenant_idx').on(
      t.promoCodeId,
      t.tenantId,
    ),
  ],
);

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
    /** "Your trial ends in N days" e-mail, sent once per trial. */
    trialReminderSentAt: timestamp('trial_reminder_sent_at', {
      withTimezone: true,
    }),
    /** Promo code applied, and how many more invoices it discounts (NULL = all). */
    promoCodeId: uuid('promo_code_id').references(() => promoCodes.id, {
      onDelete: 'set null',
    }),
    promoInvoicesLeft: integer('promo_invoices_left'),
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
    /** Credit (avoirs) deducted from this invoice, centimes; `amount` is after it. */
    creditApplied: integer('credit_applied').notNull().default(0),
    /** "Access will be suspended on …" e-mail, sent once per invoice. */
    suspensionWarningSentAt: timestamp('suspension_warning_sent_at', {
      withTimezone: true,
    }),
    ...timestamps,
  },
  (t) => [
    index('invoices_tenant_idx').on(t.tenantId, t.issuedAt),
    index('invoices_status_idx').on(t.status, t.dueAt),
  ],
);

/**
 * Devis: what a cabinet on trial pays to start its plan. A cabinet asks for
 * one from its app, or the billing sweep sends one when the trial ends. No
 * facture exists until the payment is confirmed; the plan and period here
 * then replace the subscription's. At most one is pending per cabinet.
 */
export const quotes = pgTable(
  'quotes',
  {
    id: id(),
    /** e.g. "D-2026-000042" — also the reference to write on the transfer. */
    number: text('number').notNull().unique(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
    billingPeriod: billingPeriod('billing_period').notNull(),
    /** Centimes per billing period, before discount. */
    price: integer('price').notNull(),
    /** Discount applied to this devis: the better of commercial and promo. */
    discountPercent: integer('discount_percent').notNull().default(0),
    /** Centimes to transfer, after discount. */
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('MAD'),
    /** e.g. "Abonnement Pro — mensuel (remise 10 %)" */
    description: text('description').notNull(),
    status: quoteStatus('status').notNull().default('pending'),
    /** "request" (the doctor asked) or "trial_end" (the billing sweep). */
    source: text('source').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Pay by this date; the unpaid rule (suspension) counts from it. */
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** The facture created when the payment was confirmed. */
    invoiceId: uuid('invoice_id').references(() => invoices.id, {
      onDelete: 'set null',
    }),
    voidReason: text('void_reason'),
    /** Bell and team alert sent by the billing sweep. */
    announcedAt: timestamp('announced_at', { withTimezone: true }),
    /** "Your devis is past its date" e-mail, sent once. */
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    /** "Access will be suspended on …" e-mail, sent once. */
    suspensionWarningSentAt: timestamp('suspension_warning_sent_at', {
      withTimezone: true,
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('quotes_one_pending_idx')
      .on(t.tenantId)
      .where(sql`${t.status} = 'pending'`),
    index('quotes_status_idx').on(t.status, t.dueAt),
    index('quotes_tenant_idx').on(t.tenantId, t.issuedAt),
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

/** Avoirs: A-<year>-<6 digits>, never reused. */
export const creditNoteNumberSeq = pgSequence('credit_note_number_seq');

/**
 * refund — money sent back to the cabinet (bank transfer, recorded)
 * credit — kept as a balance, deducted from the cabinet's next invoices
 */
export const creditNoteKind = pgEnum('credit_note_kind', ['refund', 'credit']);

/**
 * Avoir on a paid invoice: a full or partial refund, or a credit for the
 * next invoices. The invoice keeps its number and amount.
 */
export const creditNotes = pgTable(
  'credit_notes',
  {
    id: id(),
    /** "A-2026-000001" */
    number: text('number').notNull().unique(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'restrict' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    kind: creditNoteKind('kind').notNull(),
    /** Centimes. */
    amount: integer('amount').notNull(),
    /** For a credit: what's left to deduct from future invoices. */
    remaining: integer('remaining').notNull().default(0),
    reason: text('reason').notNull(),
    /** For a refund: when the transfer was sent, and its reference. */
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    refundReference: text('refund_reference'),
    issuedBy: uuid('issued_by').references(() => platformUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('credit_notes_tenant_idx').on(t.tenantId, t.createdAt)],
);
