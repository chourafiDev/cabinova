import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { type AuditActor, diff, writeAudit } from '../audit/audit.js';
import {
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  creditNotes,
  invoicePayments,
  invoices,
  platformUsers,
  promoCodes,
  quotes,
  subscriptionPlans,
  subscriptions,
  tenantStatusChanges,
  tenants,
} from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PlatformConfigService } from '../settings/platform-config.service.js';
import { TeamAlertsService } from '../settings/team-alerts.service.js';
import { TenantLifecycleService } from '../tenants/tenant-lifecycle.service.js';
import { BillingSettingsService } from './billing-settings.service.js';
import type {
  AttachSubscriptionDto,
  ChangeSubscriptionDto,
  ConfirmQuoteDto,
  ListInvoicesQuery,
  RecordPaymentDto,
} from './dto.js';
import {
  addDays,
  addPeriod,
  dueDate,
  firstPeriodStart,
  invoiceAmount,
  invoiceDescription,
  invoiceNumber,
  unpaidStep,
} from './periods.js';
import { type QuoteNotice, QuotesService } from './quotes.service.js';

type Subscription = typeof subscriptions.$inferSelect;
type Invoice = typeof invoices.$inferSelect;
type Notice =
  | {
      invoiceId: string;
      kind:
        'invoice' | 'overdue' | 'receipt' | 'suspension_warning' | 'suspended';
      /** suspension_warning: the day access will be cut. */
      suspendOn?: Date;
    }
  | { subscriptionId: string; kind: 'trial_ending' };

const SYSTEM: AuditActor = { userId: null };
const formatMad = (centimes: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(
    centimes / 100,
  );
const OPEN = ['billed', 'overdue'] as const;

/**
 * Module 3 — subscriptions paid by bank transfer to the platform's RIB.
 *
 * A trial ends in a devis, not a facture: the cabinet transfers, sends its
 * proof of payment, and an admin confirms it, which creates the (paid)
 * facture and starts the plan. See QuotesService.
 *
 * The sweep (hourly) sends that devis when a trial ends, invoices before
 * each renewal, moves unpaid subscriptions to past_due when their period
 * ends, marks invoices overdue after the grace period, and ends
 * subscriptions cancelled at term. An admin records each transfer seen on
 * the bank statement, which pays the invoice and extends the paid period.
 *
 * Non-payment: when "suspendAfterDays" is set (Paiements), a cabinet whose
 * invoice (or devis) stays overdue that long is suspended (reason "unpaid"), after a
 * warning e-mail; recording the payment reactivates it — only if it was
 * suspended for non-payment. 0 keeps suspension manual.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly settings: BillingSettingsService,
    private readonly email: EmailService,
    private readonly platform: PlatformConfigService,
    private readonly alerts: TeamAlertsService,
    private readonly lifecycle: TenantLifecycleService,
    private readonly notifications: NotificationsService,
    private readonly quotes: QuotesService,
  ) {}

  // ── Sweep ──────────────────────────────────────────────────────────────

  async sweep(now = new Date()) {
    const {
      graceDays,
      invoiceDaysBefore,
      trialReminderDays,
      suspendAfterDays,
    } = await this.settings.get();
    const notices: Notice[] = [];
    const quoteNotices: QuoteNotice[] = [];
    const counts = {
      issued: 0,
      quotes: 0,
      quoteReminders: 0,
      pastDue: 0,
      overdue: 0,
      cancelled: 0,
      trialReminders: 0,
      suspensionWarnings: 0,
      suspended: 0,
    };

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
        if (sub.status === 'trialing') {
          // No facture before the payment; a devis may already be waiting.
          const quote = await this.quotes.issue(
            tx,
            sub,
            now,
            graceDays,
            SYSTEM,
            'trial_end',
          );
          if (quote) {
            counts.quotes++;
            quoteNotices.push({ quoteId: quote.id, kind: 'trial_end' });
          }
        } else {
          const issued = await this.issueNext(tx, sub, now, graceDays, SYSTEM);
          if (issued) {
            counts.issued++;
            notices.push({
              invoiceId: issued.id,
              kind: issued.status === 'paid' ? 'receipt' : 'invoice',
            });
            // Fully covered by credit: the new period is already paid.
            if (issued.status === 'paid') {
              await this.extendSubscription(tx, issued);
              continue;
            }
          }
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
          notices.push({
            invoiceId: issued.id,
            kind: issued.status === 'paid' ? 'receipt' : 'invoice',
          });
          if (issued.status === 'paid')
            await this.extendSubscription(tx, issued);
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

      // 4. Trials ending soon: one reminder per trial.
      if (trialReminderDays > 0) {
        const ending = await tx
          .update(subscriptions)
          .set({ trialReminderSentAt: now })
          .where(
            and(
              eq(subscriptions.status, 'trialing'),
              isNull(subscriptions.trialReminderSentAt),
              gt(subscriptions.currentPeriodEnd, now),
              lte(
                subscriptions.currentPeriodEnd,
                addDays(now, trialReminderDays),
              ),
            ),
          )
          .returning({ id: subscriptions.id });
        for (const { id } of ending) {
          notices.push({ subscriptionId: id, kind: 'trial_ending' });
        }
        counts.trialReminders = ending.length;
      }

      // New devis (from the sweep or the doctors): tell the team once.
      const announced = await tx
        .update(quotes)
        .set({ announcedAt: now })
        .where(and(eq(quotes.status, 'pending'), isNull(quotes.announcedAt)))
        .returning({ id: quotes.id });
      for (const { id } of announced) {
        quoteNotices.push({ quoteId: id, kind: 'announce' });
      }

      // A trial still unpaid: devis past its date, reminded once.
      const unpaidQuotes = await tx
        .select({ quote: quotes })
        .from(quotes)
        .innerJoin(subscriptions, eq(subscriptions.id, quotes.subscriptionId))
        .innerJoin(tenants, eq(tenants.id, quotes.tenantId))
        .where(
          and(
            eq(quotes.status, 'pending'),
            eq(subscriptions.status, 'past_due'),
            eq(tenants.status, 'active'),
            lte(quotes.dueAt, now),
          ),
        )
        .for('update', { of: quotes, skipLocked: true });
      for (const { quote } of unpaidQuotes) {
        if (quote.reminderSentAt) continue;
        await tx
          .update(quotes)
          .set({ reminderSentAt: now })
          .where(eq(quotes.id, quote.id));
        quoteNotices.push({ quoteId: quote.id, kind: 'reminder' });
        counts.quoteReminders++;
      }

      // 5–6. Unpaid long enough: warn, then suspend (active cabinets only).
      if (suspendAfterDays > 0) {
        const overdue = await tx
          .select({ invoice: invoices })
          .from(invoices)
          .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
          .where(
            and(eq(invoices.status, 'overdue'), eq(tenants.status, 'active')),
          )
          .orderBy(asc(invoices.dueAt))
          .for('update', { of: invoices, skipLocked: true });
        const suspended = new Set<string>();
        for (const { invoice } of overdue) {
          const step = unpaidStep(invoice, suspendAfterDays, now);
          if (step.action === 'suspend') {
            if (suspended.has(invoice.tenantId)) continue;
            await this.lifecycle.applySystem(
              tx,
              invoice.tenantId,
              'suspend',
              SYSTEM,
              `Suspension automatique : facture ${invoice.number} impayée ${suspendAfterDays} jours après son échéance.`,
              'unpaid',
            );
            suspended.add(invoice.tenantId);
            notices.push({ invoiceId: invoice.id, kind: 'suspended' });
            counts.suspended++;
          } else if (step.action === 'warn') {
            await tx
              .update(invoices)
              .set({ suspensionWarningSentAt: now })
              .where(eq(invoices.id, invoice.id));
            notices.push({
              invoiceId: invoice.id,
              kind: 'suspension_warning',
              suspendOn: step.suspendOn!,
            });
            counts.suspensionWarnings++;
          }
        }

        // The same rule for a devis left unpaid after the trial.
        for (const { quote } of unpaidQuotes) {
          const step = unpaidStep(quote, suspendAfterDays, now);
          if (step.action === 'suspend') {
            await this.lifecycle.applySystem(
              tx,
              quote.tenantId,
              'suspend',
              SYSTEM,
              `Suspension automatique : devis ${quote.number} impayé ${suspendAfterDays} jours après sa date limite.`,
              'unpaid',
            );
            quoteNotices.push({ quoteId: quote.id, kind: 'suspended' });
            counts.suspended++;
          } else if (step.action === 'warn') {
            await tx
              .update(quotes)
              .set({ suspensionWarningSentAt: now })
              .where(eq(quotes.id, quote.id));
            quoteNotices.push({
              quoteId: quote.id,
              kind: 'suspension_warning',
              suspendOn: step.suspendOn!,
            });
            counts.suspensionWarnings++;
          }
        }
      }
    });

    await this.notify(notices);
    await this.quotes.notify(quoteNotices);
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

      await this.extendSubscription(tx, invoice);
      const reactivated = await this.reactivateIfUnpaidOnly(
        tx,
        invoice.tenantId,
        actor,
        invoice.number,
      );
      const [tenant] = await tx
        .select({ status: tenants.status })
        .from(tenants)
        .where(eq(tenants.id, invoice.tenantId));
      const tenantStatus = tenant?.status ?? null;
      await this.audit(tx, actor, invoice.tenantId, 'billing.payment.record', {
        invoice: invoice.number,
        amount: dto.amount,
        receivedAt: dto.receivedAt,
        reference: dto.reference ?? null,
      });
      return { invoice, tenantStatus, reactivated };
    });
    await this.notify([{ invoiceId, kind: 'receipt' }]);
    if (result.reactivated) {
      const [tenant] = await this.database.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, result.invoice.tenantId));
      await this.notifications.notify({
        kind: 'billing.tenant.reactivated',
        severity: 'success',
        title: 'Cabinet réactivé après paiement',
        body: `${tenant?.name ?? ''} — facture ${result.invoice.number} réglée.`,
        href: `/tenants/${result.invoice.tenantId}?tab=subscription`,
        tenantId: result.invoice.tenantId,
        permission: 'tenants:read',
        exceptUserId: actor.userId,
      });
    }
    return {
      ok: true,
      /** Suspended for non-payment and nothing else overdue: reactivated. */
      reactivated: result.reactivated,
      // Still suspended (another reason, or other unpaid invoices): the UI
      // suggests reviewing the cabinet's status.
      tenantSuspended: result.tenantStatus === 'suspended',
    };
  }

  /**
   * The cabinet's fiche de paiement arrived and the transfer is on the
   * statement: creates the facture (already paid), moves the subscription
   * to the devis' plan and period, and starts it.
   */
  async confirmQuote(quoteId: string, actor: AuditActor, dto: ConfirmQuoteDto) {
    const result = await this.database.db.transaction(async (tx) => {
      const quote = await this.quotes.lock(tx, quoteId);
      if (quote.status !== 'pending') {
        throw new ConflictException({
          code: 'QUOTE_NOT_PENDING',
          message: 'Ce devis n’attend pas de paiement.',
        });
      }
      if (dto.amount < quote.amount) {
        throw new BadRequestException({
          code: 'AMOUNT_TOO_LOW',
          message:
            'Montant inférieur au devis. Si le client a payé moins, annulez le devis et envoyez-en un nouveau.',
        });
      }
      const sub = await this.liveSubscription(tx, quote.tenantId);
      const [plan] = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, quote.planId));
      const receivedAt = new Date(dto.receivedAt);
      const now = new Date();
      const periodStart = firstPeriodStart(
        sub.currentPeriodEnd,
        sub.status === 'trialing',
        receivedAt,
      );
      const periodEnd = addPeriod(periodStart, quote.billingPeriod);
      const [{ n }] = await tx
        .execute<{ n: string }>(sql`select nextval('invoice_number_seq') as n`)
        .then((r) => r.rows);
      const [invoice] = await tx
        .insert(invoices)
        .values({
          number: invoiceNumber(now.getUTCFullYear(), Number(n)),
          tenantId: quote.tenantId,
          subscriptionId: sub.id,
          description:
            invoiceDescription(
              plan.name,
              quote.billingPeriod,
              periodStart,
              periodEnd,
              quote.discountPercent,
            ) + ` — devis ${quote.number}`,
          amount: quote.amount,
          periodStart,
          periodEnd,
          issuedAt: now,
          dueAt: now,
          status: 'paid',
          paidAt: receivedAt,
        })
        .returning();
      await tx.insert(invoicePayments).values({
        invoiceId: invoice.id,
        amount: dto.amount,
        receivedAt,
        reference: dto.reference,
        note: dto.note,
        recordedBy: actor.userId,
      });
      await tx
        .update(quotes)
        .set({ status: 'paid', paidAt: receivedAt, invoiceId: invoice.id })
        .where(eq(quotes.id, quote.id));
      await tx
        .update(subscriptions)
        .set({
          planId: quote.planId,
          billingPeriod: quote.billingPeriod,
          price: quote.price,
          status: 'active',
          currentPeriodEnd: periodEnd,
          ...(sub.promoCodeId &&
            sub.promoInvoicesLeft !== null && {
              promoInvoicesLeft: Math.max(0, sub.promoInvoicesLeft - 1),
            }),
        })
        .where(eq(subscriptions.id, sub.id));
      // The doctor picked another offer: its limits come with it.
      if (quote.planId !== sub.planId) {
        await this.applyQuotas(tx, quote.tenantId, plan);
      }
      const reactivated = await this.reactivateIfUnpaidOnly(
        tx,
        quote.tenantId,
        actor,
        quote.number,
      );
      await this.audit(tx, actor, quote.tenantId, 'billing.quote.paid', {
        quote: quote.number,
        invoice: invoice.number,
        amount: dto.amount,
        receivedAt: dto.receivedAt,
        reference: dto.reference ?? null,
        plan: plan.key,
      });
      return { invoice, planName: plan.name, reactivated };
    });
    const { invoice, planName, reactivated } = result;
    try {
      const [tenant] = await this.database.db
        .select()
        .from(tenants)
        .where(eq(tenants.id, invoice.tenantId));
      await this.email.sendSubscriptionStarted({
        email: tenant.email,
        name: tenant.responsibleName,
        tenantName: tenant.name,
        planName,
        invoice,
        url: await this.quotes.appUrl(tenant.id, `/factures/${invoice.id}`),
      });
    } catch (err) {
      this.logger.error('Subscription started e-mail failed', err);
    }
    return { ok: true, invoiceId: invoice.id, reactivated };
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
      if (await this.quotes.quoteable(tx, sub)) {
        throw new ConflictException({
          code: 'QUOTE_FIRST',
          message:
            'Ce cabinet n’a encore rien payé : envoyez-lui un devis, la facture suivra le paiement.',
        });
      }
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
      /** No facture before payment: the next step is a devis. */
      quoteable: sub
        ? await db.transaction((tx) =>
            this.quotes.quoteable(tx, sub.subscription),
          )
        : false,
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

    // Promo code still running: the better of it and the commercial discount.
    const [promo] =
      sub.promoCodeId && (sub.promoInvoicesLeft ?? 1) > 0
        ? await tx
            .select({
              code: promoCodes.code,
              percent: promoCodes.discountPercent,
            })
            .from(promoCodes)
            .where(eq(promoCodes.id, sub.promoCodeId))
        : [];
    const usePromo = !!promo && promo.percent > sub.discountPercent;
    const discount = usePromo ? promo.percent : sub.discountPercent;
    if (promo && sub.promoInvoicesLeft !== null) {
      await tx
        .update(subscriptions)
        .set({ promoInvoicesLeft: sub.promoInvoicesLeft - 1 })
        .where(eq(subscriptions.id, sub.id));
    }
    const gross = invoiceAmount(sub.price, discount);
    const credit = await this.consumeCredit(tx, sub.tenantId, gross);
    const amount = gross - credit;
    const [{ n }] = await tx
      .execute<{ n: string }>(sql`select nextval('invoice_number_seq') as n`)
      .then((r) => r.rows);
    const [invoice] = await tx
      .insert(invoices)
      .values({
        number: invoiceNumber(now.getUTCFullYear(), Number(n)),
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        description:
          invoiceDescription(
            plan.name,
            sub.billingPeriod,
            periodStart,
            periodEnd,
            discount,
          ) +
          (usePromo ? ` — code ${promo.code}` : '') +
          (credit ? ` — avoir déduit : ${formatMad(credit)}` : ''),
        amount,
        creditApplied: credit,
        periodStart,
        periodEnd,
        issuedAt: now,
        dueAt: dueDate(periodStart, now, graceDays),
        // Entirely covered by credit: nothing to transfer.
        ...(amount === 0 && { status: 'paid' as const, paidAt: now }),
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

  /** A paid invoice extends its subscription to the end of the invoiced period. */
  private async extendSubscription(tx: Transaction, invoice: Invoice) {
    if (!invoice.subscriptionId) return;
    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, invoice.subscriptionId))
      .for('update');
    if (!sub || sub.status === 'cancelled') return;
    const paidUntil =
      sub.currentPeriodEnd && sub.currentPeriodEnd > invoice.periodEnd
        ? sub.currentPeriodEnd
        : invoice.periodEnd;
    await tx
      .update(subscriptions)
      // If paidUntil is already past, the sweep invoices the following
      // period and moves it back to past_due.
      .set({ currentPeriodEnd: paidUntil, status: 'active' })
      .where(eq(subscriptions.id, sub.id));
  }

  /**
   * After a payment: reactivates a cabinet whose current suspension is for
   * non-payment, once nothing is overdue any more. Never lifts a suspension
   * made for another reason (fraud, security…).
   */
  private async reactivateIfUnpaidOnly(
    tx: Transaction,
    tenantId: string,
    actor: AuditActor,
    invoiceNumber: string,
  ) {
    const [tenant] = await tx
      .select({ status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    if (tenant?.status !== 'suspended') return false;
    const [last] = await tx
      .select({ reason: tenantStatusChanges.reason })
      .from(tenantStatusChanges)
      .where(
        and(
          eq(tenantStatusChanges.tenantId, tenantId),
          eq(tenantStatusChanges.toStatus, 'suspended'),
          eq(tenantStatusChanges.state, 'applied'),
        ),
      )
      .orderBy(desc(tenantStatusChanges.appliedAt))
      .limit(1);
    if (last?.reason !== 'unpaid') return false;
    const [stillOverdue] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'overdue')),
      )
      .limit(1);
    if (stillOverdue) return false;
    await this.lifecycle.applySystem(
      tx,
      tenantId,
      'reactivate',
      actor,
      `Réactivation automatique : paiement de la facture ${invoiceNumber} enregistré.`,
      'payment_regularized',
    );
    return true;
  }

  /** Deducts the cabinet's credit (oldest avoir first) from an amount; returns what was used. */
  private async consumeCredit(
    tx: Transaction,
    tenantId: string,
    amount: number,
  ) {
    if (amount <= 0) return 0;
    const notes = await tx
      .select({ id: creditNotes.id, remaining: creditNotes.remaining })
      .from(creditNotes)
      .where(
        and(
          eq(creditNotes.tenantId, tenantId),
          eq(creditNotes.kind, 'credit'),
          gt(creditNotes.remaining, 0),
        ),
      )
      .orderBy(asc(creditNotes.createdAt))
      .for('update');
    let used = 0;
    for (const note of notes) {
      if (used >= amount) break;
      const take = Math.min(note.remaining, amount - used);
      await tx
        .update(creditNotes)
        .set({ remaining: note.remaining - take })
        .where(eq(creditNotes.id, note.id));
      used += take;
    }
    return used;
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
    const { cabinets } = await this.platform.get('notifications');
    // Suspension notices always go out: they're about access.
    const enabled: Record<Notice['kind'], boolean> = {
      invoice: cabinets.invoiceIssued,
      overdue: cabinets.invoiceOverdue,
      receipt: cabinets.paymentReceipt,
      trial_ending: cabinets.trialEnding,
      suspension_warning: true,
      suspended: true,
    };
    for (const notice of notices) {
      try {
        if (notice.kind === 'trial_ending') {
          if (!enabled.trial_ending) continue;
          const [row] = await this.database.db
            .select({
              sub: subscriptions,
              tenant: tenants,
              plan: subscriptionPlans,
            })
            .from(subscriptions)
            .innerJoin(tenants, eq(tenants.id, subscriptions.tenantId))
            .innerJoin(
              subscriptionPlans,
              eq(subscriptionPlans.id, subscriptions.planId),
            )
            .where(eq(subscriptions.id, notice.subscriptionId));
          if (!row?.sub.currentPeriodEnd) continue;
          await this.email.sendTrialEnding({
            email: row.tenant.email,
            name: row.tenant.responsibleName,
            tenantName: row.tenant.name,
            planName: row.plan.name,
            endsAt: row.sub.currentPeriodEnd,
            amount: invoiceAmount(row.sub.price, row.sub.discountPercent),
            period: row.sub.billingPeriod,
          });
          continue;
        }
        const [row] = await this.database.db
          .select({ invoice: invoices, tenant: tenants })
          .from(invoices)
          .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
          .where(eq(invoices.id, notice.invoiceId));
        if (!row) continue;
        if (notice.kind === 'overdue') {
          await this.alerts.send('invoiceOverdue', {
            subject: `Facture ${row.invoice.number} en retard — ${row.tenant.name}`,
            lines: [
              `Montant : ${formatMad(row.invoice.amount)}`,
              `Échéance : ${row.invoice.dueAt.toISOString().slice(0, 10)}`,
            ],
            path: `/tenants/${row.tenant.id}?tab=subscription`,
          });
        }
        if (notice.kind === 'overdue') {
          await this.notifications.notify({
            kind: 'billing.invoice.overdue',
            severity: 'warning',
            title: `Facture ${row.invoice.number} en retard`,
            body: `${row.tenant.name} — ${formatMad(row.invoice.amount)}`,
            href: `/tenants/${row.tenant.id}?tab=subscription`,
            tenantId: row.tenant.id,
            permission: 'billing:read',
          });
        }
        if (notice.kind === 'suspended') {
          await this.notifications.notify({
            kind: 'billing.tenant.suspended',
            severity: 'critical',
            title: 'Cabinet suspendu pour impayé',
            body: `${row.tenant.name} — facture ${row.invoice.number}, ${formatMad(row.invoice.amount)}`,
            href: `/tenants/${row.tenant.id}?tab=subscription`,
            tenantId: row.tenant.id,
            permission: 'tenants:read',
          });
          await this.alerts.send('invoiceOverdue', {
            subject: `Cabinet suspendu pour impayé — ${row.tenant.name}`,
            lines: [
              `Facture ${row.invoice.number} : ${formatMad(row.invoice.amount)}`,
            ],
            path: `/tenants/${row.tenant.id}?tab=subscription`,
          });
        }
        if (!enabled[notice.kind]) continue;
        await this.email.sendBillingNotice({
          email: row.tenant.email,
          name: row.tenant.responsibleName,
          tenantName: row.tenant.name,
          kind: notice.kind,
          invoice: row.invoice,
          bank,
          suspendOn: notice.suspendOn,
        });
      } catch (err) {
        this.logger.error(`Billing notice ${notice.kind} failed`, err);
      }
    }
  }
}
