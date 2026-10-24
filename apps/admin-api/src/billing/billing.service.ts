import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm';
import { type AuditActor, diff, writeAudit } from '../audit/audit.js';
import {
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  invoicePayments,
  invoices,
  platformUsers,
  subscriptionPlans,
  subscriptions,
  tenants,
} from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import { BillingSettingsService } from './billing-settings.service.js';
import type {
  AttachSubscriptionDto,
  ChangeSubscriptionDto,
  ListInvoicesQuery,
  RecordPaymentDto,
} from './dto.js';
import {
  addDays,
  addPeriod,
  dueDate,
  invoiceAmount,
  invoiceDescription,
  invoiceNumber,
} from './periods.js';

type Subscription = typeof subscriptions.$inferSelect;
type Invoice = typeof invoices.$inferSelect;
type Notice = { invoiceId: string; kind: 'invoice' | 'overdue' | 'receipt' };

const SYSTEM: AuditActor = { userId: null };
const OPEN = ['billed', 'overdue'] as const;

/**
 * Module 3 — subscriptions paid by bank transfer to the platform's RIB.
 *
 * The sweep (hourly) issues invoices when a trial ends and before each
 * renewal, moves unpaid subscriptions to past_due when their period ends,
 * marks invoices overdue after the grace period, and ends subscriptions
 * cancelled at term. An admin records each transfer seen on the bank
 * statement, which pays the invoice and extends the paid period. Access is
 * never cut automatically: suspending a cabinet for non-payment stays a
 * deliberate decision (Module 2), as the spec leaves it "à voir".
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly settings: BillingSettingsService,
    private readonly email: EmailService,
  ) {}

  // ── Sweep ──────────────────────────────────────────────────────────────

  async sweep(now = new Date()) {
    const { graceDays, invoiceDaysBefore } = await this.settings.get();
    const notices: Notice[] = [];
    const counts = { issued: 0, pastDue: 0, overdue: 0, cancelled: 0 };

    await this.database.db.transaction(async (tx) => {
      // 1. Trials that ended, and paid periods that ended: invoice the next
      //    period (unless cancelled at term) and wait for the transfer.
      const ended = await tx
        .select()
        .from(subscriptions)
        .where(
          and(
            inArray(subscriptions.status, ['trialing', 'active']),
            lte(subscriptions.currentPeriodEnd, now),
          ),
        )
        .for('update', { skipLocked: true });
      for (const sub of ended) {
        if (sub.cancelAtPeriodEnd) {
          await this.cancel(tx, sub, SYSTEM, 'term');
          counts.cancelled++;
          continue;
        }
        const issued = await this.issueNext(tx, sub, now, graceDays, SYSTEM);
        if (issued) {
          counts.issued++;
          notices.push({ invoiceId: issued.id, kind: 'invoice' });
        }
        await tx
          .update(subscriptions)
          .set({ status: 'past_due' })
          .where(eq(subscriptions.id, sub.id));
        await this.audit(
          tx,
          SYSTEM,
          sub.tenantId,
          'billing.subscription.past_due',
          {
            from: sub.status,
            periodEnd: sub.currentPeriodEnd,
          },
        );
        counts.pastDue++;
      }

      // 2. Paid subscriptions nearing renewal: invoice the next period early.
      const renewing = await tx
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, 'active'),
            eq(subscriptions.cancelAtPeriodEnd, false),
            lte(
              subscriptions.currentPeriodEnd,
              addDays(now, invoiceDaysBefore),
            ),
          ),
        )
        .for('update', { skipLocked: true });
      for (const sub of renewing) {
        const issued = await this.issueNext(tx, sub, now, graceDays, SYSTEM);
        if (issued) {
          counts.issued++;
          notices.push({ invoiceId: issued.id, kind: 'invoice' });
        }
      }

      // 3. Unpaid invoices past their due date.
      const late = await tx
        .update(invoices)
        .set({ status: 'overdue' })
        .where(and(eq(invoices.status, 'billed'), lte(invoices.dueAt, now)))
        .returning();
      for (const invoice of late) {
        await this.audit(
          tx,
          SYSTEM,
          invoice.tenantId,
          'billing.invoice.overdue',
          {
            invoice: invoice.number,
            amount: invoice.amount,
          },
        );
        notices.push({ invoiceId: invoice.id, kind: 'overdue' });
      }
      counts.overdue = late.length;
    });

    await this.notify(notices);
    if (Object.values(counts).some(Boolean)) {
      this.logger.log(`Billing sweep: ${JSON.stringify(counts)}`);
    }
    return counts;
  }

  // ── Admin actions ──────────────────────────────────────────────────────

  /**
   * A transfer arrived on the bank account: pays the invoice and extends the
   * subscription to the end of the invoiced period.
   */
  async recordPayment(
    invoiceId: string,
    actor: AuditActor,
    dto: RecordPaymentDto,
  ) {
    const result = await this.database.db.transaction(async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (!OPEN.includes(invoice.status as (typeof OPEN)[number])) {
        throw new ConflictException({
          code: 'INVOICE_NOT_OPEN',
          message: 'Cette facture n’attend pas de paiement.',
        });
      }
      if (dto.amount < invoice.amount) {
        throw new BadRequestException({
          code: 'AMOUNT_TOO_LOW',
          message:
            'Montant inférieur à la facture. Si le client a payé moins, annulez la facture et émettez-en une nouvelle.',
        });
      }
      const receivedAt = new Date(dto.receivedAt);
      await tx.insert(invoicePayments).values({
        invoiceId,
        amount: dto.amount,
        receivedAt,
        reference: dto.reference,
        note: dto.note,
        recordedBy: actor.userId,
      });
      await tx
        .update(invoices)
        .set({ status: 'paid', paidAt: receivedAt })
        .where(eq(invoices.id, invoiceId));

      let tenantStatus: string | null = null;
      if (invoice.subscriptionId) {
        const [sub] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, invoice.subscriptionId))
          .for('update');
        if (sub && sub.status !== 'cancelled') {
          const paidUntil =
            sub.currentPeriodEnd && sub.currentPeriodEnd > invoice.periodEnd
              ? sub.currentPeriodEnd
              : invoice.periodEnd;
          await tx
            .update(subscriptions)
            .set({
              currentPeriodEnd: paidUntil,
              // If paidUntil is already past, the sweep invoices the
              // following period and moves it back to past_due.
              status: 'active',
            })
            .where(eq(subscriptions.id, sub.id));
        }
        const [tenant] = await tx
          .select({ status: tenants.status })
          .from(tenants)
          .where(eq(tenants.id, invoice.tenantId));
        tenantStatus = tenant?.status ?? null;
      }
      await this.audit(tx, actor, invoice.tenantId, 'billing.payment.record', {
        invoice: invoice.number,
        amount: dto.amount,
        receivedAt: dto.receivedAt,
        reference: dto.reference ?? null,
      });
      return { invoice, tenantStatus };
    });
    await this.notify([{ invoiceId, kind: 'receipt' }]);
    return {
      ok: true,
      // The UI suggests reactivating a cabinet suspended for non-payment.
      tenantSuspended: result.tenantStatus === 'suspended',
    };
  }

  /** Cancels an unpaid invoice (wrong amount…). The number is never reused. */
  async voidInvoice(invoiceId: string, actor: AuditActor, reason: string) {
    return this.database.db.transaction(async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (!OPEN.includes(invoice.status as (typeof OPEN)[number])) {
        throw new ConflictException({
          code: 'INVOICE_NOT_OPEN',
          message: 'Seule une facture non payée peut être annulée.',
        });
      }
      await tx
        .update(invoices)
        .set({ status: 'void' })
        .where(eq(invoices.id, invoiceId));
      await this.audit(tx, actor, invoice.tenantId, 'billing.invoice.void', {
        invoice: invoice.number,
        amount: invoice.amount,
        reason,
      });
      return { ok: true };
    });
  }

  /**
   * Issues the next invoice now (after a voided one, or to bill a cabinet
   * before the sweep would). Refused if one is already waiting.
   */
  async issueNow(tenantId: string, actor: AuditActor) {
    const { graceDays } = await this.settings.get();
    const invoice = await this.database.db.transaction(async (tx) => {
      const sub = await this.liveSubscription(tx, tenantId);
      const issued = await this.issueNext(
        tx,
        sub,
        new Date(),
        graceDays,
        actor,
      );
      if (!issued) {
        throw new ConflictException({
          code: 'INVOICE_PENDING',
          message: 'Une facture attend déjà son paiement pour cette période.',
        });
      }
      return issued;
    });
    await this.notify([{ invoiceId: invoice.id, kind: 'invoice' }]);
    return invoice;
  }

  /**
   * New plan, period or discount for a live subscription. Applies from the
   * next invoice; invoices already issued keep their amount.
   */
  async changeSubscription(
    tenantId: string,
    actor: AuditActor,
    dto: ChangeSubscriptionDto,
  ) {
    return this.database.db.transaction(async (tx) => {
      const sub = await this.liveSubscription(tx, tenantId);
      const plan = await this.activePlan(tx, dto.planKey);
      const next = {
        planId: plan.id,
        billingPeriod: dto.billingPeriod,
        price:
          dto.billingPeriod === 'annual' ? plan.priceAnnual : plan.priceMonthly,
        discountPercent: dto.discountPercent,
      };
      const changes = diff(sub, next, [
        'planId',
        'billingPeriod',
        'price',
        'discountPercent',
      ]);
      if (Object.keys(changes).length) {
        await tx
          .update(subscriptions)
          .set(next)
          .where(eq(subscriptions.id, sub.id));
      }
      if (dto.applyQuotas) await this.applyQuotas(tx, tenantId, plan);
      if (Object.keys(changes).length || dto.applyQuotas) {
        await this.audit(tx, actor, tenantId, 'billing.subscription.change', {
          plan: plan.key,
          changes,
          applyQuotas: dto.applyQuotas,
        });
      }
      return { ok: true };
    });
  }

  /**
   * Gives a plan to a cabinet without one: a trial, or (0 days) the first
   * invoice right away.
   */
  async attachSubscription(
    tenantId: string,
    actor: AuditActor,
    dto: AttachSubscriptionDto,
  ) {
    const { graceDays } = await this.settings.get();
    const created = await this.database.db.transaction(async (tx) => {
      const [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .for('update');
      if (!tenant) throw new NotFoundException('Cabinet introuvable.');
      if (tenant.status === 'closed') {
        throw new ConflictException({
          code: 'TENANT_CLOSED',
          message: 'Ce cabinet est fermé.',
        });
      }
      const [existing] = await tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.tenantId, tenantId),
            ne(subscriptions.status, 'cancelled'),
          ),
        );
      if (existing) {
        throw new ConflictException({
          code: 'SUBSCRIPTION_EXISTS',
          message: 'Ce cabinet a déjà un abonnement : changez plutôt d’offre.',
        });
      }
      const plan = await this.activePlan(tx, dto.planKey);
      const now = new Date();
      const [sub] = await tx
        .insert(subscriptions)
        .values({
          tenantId,
          planId: plan.id,
          billingPeriod: dto.billingPeriod,
          price:
            dto.billingPeriod === 'annual'
              ? plan.priceAnnual
              : plan.priceMonthly,
          discountPercent: dto.discountPercent,
          status: dto.trialDays ? 'trialing' : 'past_due',
          startedAt: now,
          currentPeriodEnd: dto.trialDays ? addDays(now, dto.trialDays) : now,
        })
        .returning();
      if (dto.applyQuotas) await this.applyQuotas(tx, tenantId, plan);
      await this.audit(tx, actor, tenantId, 'billing.subscription.attach', {
        plan: plan.key,
        billingPeriod: dto.billingPeriod,
        trialDays: dto.trialDays,
        discountPercent: dto.discountPercent,
      });
      const invoice = dto.trialDays
        ? null
        : await this.issueNext(tx, sub, now, graceDays, actor);
      return invoice;
    });
    if (created)
      await this.notify([{ invoiceId: created.id, kind: 'invoice' }]);
    return { ok: true };
  }

  /** Résiliation at term (or undoing it): no new invoice after the paid period. */
  async setCancelAtTerm(
    tenantId: string,
    actor: AuditActor,
    cancelAtPeriodEnd: boolean,
  ) {
    return this.database.db.transaction(async (tx) => {
      const sub = await this.liveSubscription(tx, tenantId);
      if (sub.cancelAtPeriodEnd === cancelAtPeriodEnd) return { ok: true };
      await tx
        .update(subscriptions)
        .set({ cancelAtPeriodEnd })
        .where(eq(subscriptions.id, sub.id));
      await this.audit(
        tx,
        actor,
        tenantId,
        'billing.subscription.cancel_at_term',
        {
          cancelAtPeriodEnd,
          periodEnd: sub.currentPeriodEnd,
        },
      );
      return { ok: true };
    });
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  async listInvoices(query: ListInvoicesQuery) {
    const term = query.search?.trim();
    const rows = await this.database.db
      .select({
        invoice: invoices,
        tenant: { id: tenants.id, name: tenants.name, status: tenants.status },
      })
      .from(invoices)
      .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
      .where(
        and(
          query.status === 'open'
            ? inArray(invoices.status, [...OPEN])
            : query.status
              ? eq(invoices.status, query.status as Invoice['status'])
              : undefined,
          query.tenantId ? eq(invoices.tenantId, query.tenantId) : undefined,
          term
            ? or(
                ilike(invoices.number, `%${term}%`),
                ilike(tenants.name, `%${term}%`),
              )
            : undefined,
        ),
      )
      .orderBy(
        // Waiting for a transfer first, oldest due date first.
        sql`case ${invoices.status} when 'overdue' then 0 when 'billed' then 1 else 2 end`,
        sql`case when ${invoices.status} in ('overdue','billed') then ${invoices.dueAt} end asc`,
        desc(invoices.issuedAt),
      )
      .limit(200);
    const [totals] = await this.database.db
      .select({
        open: sql<number>`coalesce(sum(${invoices.amount}) filter (where ${invoices.status} = 'billed'), 0)`.mapWith(
          Number,
        ),
        overdue:
          sql<number>`coalesce(sum(${invoices.amount}) filter (where ${invoices.status} = 'overdue'), 0)`.mapWith(
            Number,
          ),
        overdueCount:
          sql<number>`count(*) filter (where ${invoices.status} = 'overdue')`.mapWith(
            Number,
          ),
        collectedThisMonth:
          sql<number>`coalesce(sum(${invoices.amount}) filter (where ${invoices.status} = 'paid' and ${invoices.paidAt} >= date_trunc('month', now())), 0)`.mapWith(
            Number,
          ),
      })
      .from(invoices);
    return {
      totals,
      data: rows.map((r) => ({ ...r.invoice, tenant: r.tenant })),
    };
  }

  /** One invoice with its payments, the cabinet and the issuer's details (print view). */
  async getInvoice(id: string) {
    const db = this.database.db;
    const [row] = await db
      .select({ invoice: invoices, tenant: tenants })
      .from(invoices)
      .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
      .where(eq(invoices.id, id));
    if (!row) throw new NotFoundException('Facture introuvable.');
    const payments = await db
      .select({
        id: invoicePayments.id,
        amount: invoicePayments.amount,
        receivedAt: invoicePayments.receivedAt,
        reference: invoicePayments.reference,
        note: invoicePayments.note,
        recordedBy: platformUsers.name,
      })
      .from(invoicePayments)
      .leftJoin(platformUsers, eq(platformUsers.id, invoicePayments.recordedBy))
      .where(eq(invoicePayments.invoiceId, id));
    const t = row.tenant;
    return {
      ...row.invoice,
      tenant: {
        id: t.id,
        name: t.name,
        legalName: t.legalName,
        address: t.address,
        city: t.city,
        email: t.email,
        responsibleName: t.responsibleName,
        status: t.status,
      },
      payments,
      issuer: await this.settings.get(),
    };
  }

  /** The cabinet page's Abonnement tab: live subscription + its invoices. */
  async tenantBilling(tenantId: string) {
    const db = this.database.db;
    const [sub] = await db
      .select({ subscription: subscriptions, plan: subscriptionPlans })
      .from(subscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, subscriptions.planId),
      )
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          ne(subscriptions.status, 'cancelled'),
        ),
      );
    const list = await this.listInvoices({ tenantId });
    return {
      subscription: sub
        ? {
            ...sub.subscription,
            nextAmount: invoiceAmount(
              sub.subscription.price,
              sub.subscription.discountPercent,
            ),
            plan: { key: sub.plan.key, name: sub.plan.name },
          }
        : null,
      invoices: list.data,
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────

  /**
   * Invoices the period starting at the subscription's paid-until date.
   * Idempotent: nothing is issued while an invoice is still unpaid, or if
   * that period was already invoiced.
   */
  private async issueNext(
    tx: Transaction,
    sub: Subscription,
    now: Date,
    graceDays: number,
    actor: AuditActor,
  ) {
    const periodStart =
      sub.currentPeriodEnd && sub.currentPeriodEnd > sub.startedAt
        ? sub.currentPeriodEnd
        : now;
    // At most one unpaid invoice per subscription, and never the same period twice.
    const [existing] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.subscriptionId, sub.id),
          or(
            inArray(invoices.status, [...OPEN]),
            and(
              eq(invoices.periodStart, periodStart),
              ne(invoices.status, 'void'),
            ),
          ),
        ),
      );
    if (existing) return null;

    const [plan] = await tx
      .select({ name: subscriptionPlans.name })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, sub.planId));
    const periodEnd = addPeriod(periodStart, sub.billingPeriod);
    const [{ n }] = await tx
      .execute<{ n: string }>(sql`select nextval('invoice_number_seq') as n`)
      .then((r) => r.rows);
    const [invoice] = await tx
      .insert(invoices)
      .values({
        number: invoiceNumber(now.getUTCFullYear(), Number(n)),
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        description: invoiceDescription(
          plan.name,
          sub.billingPeriod,
          periodStart,
          periodEnd,
          sub.discountPercent,
        ),
        amount: invoiceAmount(sub.price, sub.discountPercent),
        periodStart,
        periodEnd,
        issuedAt: now,
        dueAt: dueDate(periodStart, now, graceDays),
      })
      .returning();
    await this.audit(tx, actor, sub.tenantId, 'billing.invoice.issue', {
      invoice: invoice.number,
      amount: invoice.amount,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
    return invoice;
  }

  private async cancel(
    tx: Transaction,
    sub: Subscription,
    actor: AuditActor,
    why: 'term',
  ) {
    await tx
      .update(subscriptions)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(subscriptions.id, sub.id));
    await this.audit(
      tx,
      actor,
      sub.tenantId,
      'billing.subscription.cancelled',
      { why },
    );
  }

  private async applyQuotas(
    tx: Transaction,
    tenantId: string,
    plan: typeof subscriptionPlans.$inferSelect,
  ) {
    await tx
      .update(tenants)
      .set({
        maxDoctors: plan.maxDoctors,
        maxSecretaries: plan.maxSecretaries,
        maxUsers: plan.maxUsers,
        storageQuotaMb: plan.storageQuotaMb,
      })
      .where(eq(tenants.id, tenantId));
  }

  private async liveSubscription(tx: Transaction, tenantId: string) {
    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          ne(subscriptions.status, 'cancelled'),
        ),
      )
      .for('update');
    if (!sub) {
      throw new NotFoundException({
        code: 'NO_SUBSCRIPTION',
        message: 'Ce cabinet n’a pas d’abonnement en cours.',
      });
    }
    return sub;
  }

  private async activePlan(tx: Transaction, key: string) {
    const [plan] = await tx
      .select()
      .from(subscriptionPlans)
      .where(
        and(eq(subscriptionPlans.key, key), eq(subscriptionPlans.active, true)),
      );
    if (!plan) {
      throw new BadRequestException({
        code: 'PLAN_UNAVAILABLE',
        message: "Cette offre n'existe pas ou n'est plus proposée.",
      });
    }
    return plan;
  }

  private async lockInvoice(tx: Transaction, id: string) {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .for('update');
    if (!invoice) throw new NotFoundException('Facture introuvable.');
    return invoice;
  }

  private audit(
    tx: Transaction,
    actor: AuditActor,
    tenantId: string,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    return writeAudit(tx, actor, {
      action,
      entity: 'tenant',
      entityId: tenantId,
      tenantId,
      metadata,
    });
  }

  /** E-mails after commit; a failure is logged, never blocks billing. */
  private async notify(notices: Notice[]) {
    if (!notices.length) return;
    const settings = await this.settings.get();
    const bank = settings.configured
      ? {
          accountHolder: settings.accountHolder,
          bankName: settings.bankName,
          rib: settings.rib,
          swift: settings.swift,
        }
      : null;
    for (const { invoiceId, kind } of notices) {
      try {
        const [row] = await this.database.db
          .select({ invoice: invoices, tenant: tenants })
          .from(invoices)
          .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
          .where(eq(invoices.id, invoiceId));
        if (!row) continue;
        await this.email.sendBillingNotice({
          email: row.tenant.email,
          name: row.tenant.responsibleName,
          tenantName: row.tenant.name,
          kind,
          invoice: row.invoice,
          bank,
        });
      } catch (err) {
        this.logger.error(
          `Billing notice ${kind} for ${invoiceId} failed`,
          err,
        );
      }
    }
  }
}
