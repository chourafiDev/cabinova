import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { type AuditActor, writeAudit } from '../audit/audit.js';
import type { Env } from '../config/env.js';
import {
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  invoices,
  promoCodes,
  quotes,
  subscriptionPlans,
  subscriptions,
  tenantDomains,
  tenants,
} from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PlatformConfigService } from '../settings/platform-config.service.js';
import { TeamAlertsService } from '../settings/team-alerts.service.js';
import { BillingSettingsService } from './billing-settings.service.js';
import type { ListQuotesQuery } from './dto.js';
import {
  dueDate,
  invoiceAmount,
  quoteDescription,
  quoteNumber,
} from './periods.js';

type Subscription = typeof subscriptions.$inferSelect;
type Quote = typeof quotes.$inferSelect;
type CabinetNotice =
  'request' | 'trial_end' | 'reminder' | 'suspension_warning' | 'suspended';
export type QuoteNotice =
  | { quoteId: string; kind: CabinetNotice; suspendOn?: Date }
  /** New devis, for the team: the bell and the alert e-mail. */
  | { quoteId: string; kind: 'announce' };

const formatMad = (centimes: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(
    centimes / 100,
  );

/**
 * Devis: how a cabinet on trial starts paying. clinic-api creates one when
 * the doctor asks (billing/quotes.ts, same rules); this service creates one
 * at trial end or on an admin's request, and answers the admin screens.
 * Confirming the payment is in BillingService, with the rest of invoicing.
 */
@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly settings: BillingSettingsService,
    private readonly email: EmailService,
    private readonly platform: PlatformConfigService,
    private readonly alerts: TeamAlertsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** The devis for the subscription's own terms; null if one is pending. */
  async issue(
    tx: Transaction,
    sub: Subscription,
    now: Date,
    graceDays: number,
    actor: AuditActor,
    source: 'trial_end' | 'admin',
  ) {
    if (await this.pending(tx, sub.tenantId)) return null;
    const [plan] = await tx
      .select({ name: subscriptionPlans.name })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, sub.planId));
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
    const [{ n }] = await tx
      .execute<{ n: string }>(sql`select nextval('quote_number_seq') as n`)
      .then((r) => r.rows);
    const [quote] = await tx
      .insert(quotes)
      .values({
        number: quoteNumber(now.getUTCFullYear(), Number(n)),
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        planId: sub.planId,
        billingPeriod: sub.billingPeriod,
        price: sub.price,
        discountPercent: discount,
        amount: invoiceAmount(sub.price, discount),
        description:
          quoteDescription(plan.name, sub.billingPeriod, discount) +
          (usePromo ? ` — code ${promo.code}` : ''),
        source,
        issuedAt: now,
        dueAt: dueDate(sub.currentPeriodEnd ?? now, now, graceDays),
        // Sent by the team itself: no need to announce it to them.
        ...(source === 'admin' && { announcedAt: now }),
      })
      .returning();
    await this.audit(tx, actor, sub.tenantId, 'billing.quote.issue', {
      quote: quote.number,
      amount: quote.amount,
      source,
    });
    return quote;
  }

  /** "Envoyer un devis" on the cabinet page. */
  async sendForTenant(tenantId: string, actor: AuditActor) {
    const { graceDays } = await this.settings.get();
    const quote = await this.database.db.transaction(async (tx) => {
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
      if (!(await this.quoteable(tx, sub))) {
        throw new ConflictException({
          code: 'NOT_QUOTEABLE',
          message: 'Le devis concerne un cabinet en essai, pas encore facturé.',
        });
      }
      const issued = await this.issue(
        tx,
        sub,
        new Date(),
        graceDays,
        actor,
        'admin',
      );
      if (!issued) {
        throw new ConflictException({
          code: 'QUOTE_PENDING',
          message: 'Un devis attend déjà son paiement pour ce cabinet.',
        });
      }
      return issued;
    });
    await this.notify([{ quoteId: quote.id, kind: 'request' }]);
    return quote;
  }

  /** On trial, or waiting since the trial with no facture ever issued. */
  async quoteable(tx: Transaction, sub: Subscription) {
    if (sub.status === 'trialing') return true;
    if (sub.status !== 'past_due') return false;
    const [invoice] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(eq(invoices.subscriptionId, sub.id), ne(invoices.status, 'void')),
      )
      .limit(1);
    return !invoice;
  }

  async voidQuote(id: string, actor: AuditActor, reason: string) {
    return this.database.db.transaction(async (tx) => {
      const quote = await this.lock(tx, id);
      if (quote.status !== 'pending') {
        throw new ConflictException({
          code: 'QUOTE_NOT_PENDING',
          message: 'Seul un devis en attente peut être annulé.',
        });
      }
      await tx
        .update(quotes)
        .set({ status: 'void', voidReason: reason })
        .where(eq(quotes.id, id));
      await this.audit(tx, actor, quote.tenantId, 'billing.quote.void', {
        quote: quote.number,
        amount: quote.amount,
        reason,
      });
      return { ok: true };
    });
  }

  async lock(tx: Transaction, id: string) {
    const [quote] = await tx
      .select()
      .from(quotes)
      .where(eq(quotes.id, id))
      .for('update');
    if (!quote) throw new NotFoundException('Devis introuvable.');
    return quote;
  }

  private async pending(tx: Transaction, tenantId: string) {
    const [quote] = await tx
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.tenantId, tenantId), eq(quotes.status, 'pending')));
    return quote ?? null;
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  async list(query: ListQuotesQuery) {
    const db = this.database.db;
    const rows = await db
      .select({
        quote: quotes,
        tenant: { id: tenants.id, name: tenants.name, status: tenants.status },
        plan: { name: subscriptionPlans.name },
        invoiceNumber: invoices.number,
      })
      .from(quotes)
      .innerJoin(tenants, eq(tenants.id, quotes.tenantId))
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, quotes.planId))
      .leftJoin(invoices, eq(invoices.id, quotes.invoiceId))
      .where(
        and(
          query.tenantId ? eq(quotes.tenantId, query.tenantId) : undefined,
          query.status
            ? inArray(quotes.status, [query.status as Quote['status']])
            : undefined,
        ),
      )
      .orderBy(
        sql`case ${quotes.status} when 'pending' then 0 else 1 end`,
        desc(quotes.issuedAt),
      )
      .limit(200);
    return {
      data: rows.map((r) => ({
        ...r.quote,
        tenant: r.tenant,
        planName: r.plan.name,
        invoiceNumber: r.invoiceNumber,
      })),
    };
  }

  /** One devis with the cabinet and the issuer's details (print view). */
  async get(id: string) {
    const [row] = await this.database.db
      .select({
        quote: quotes,
        tenant: tenants,
        plan: { name: subscriptionPlans.name },
        invoiceNumber: invoices.number,
      })
      .from(quotes)
      .innerJoin(tenants, eq(tenants.id, quotes.tenantId))
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, quotes.planId))
      .leftJoin(invoices, eq(invoices.id, quotes.invoiceId))
      .where(eq(quotes.id, id));
    if (!row) throw new NotFoundException('Devis introuvable.');
    const t = row.tenant;
    return {
      ...row.quote,
      planName: row.plan.name,
      invoiceNumber: row.invoiceNumber,
      tenant: {
        id: t.id,
        name: t.name,
        legalName: t.legalName,
        address: t.address,
        city: t.city,
        email: t.email,
        responsibleName: t.responsibleName,
      },
      issuer: await this.settings.get(),
    };
  }

  // ── E-mails ────────────────────────────────────────────────────────────

  /** The page in the cabinet's own app ("/devis/…", "/factures/…"). */
  async appUrl(tenantId: string, path: string) {
    const [domain] = await this.database.db
      .select({ subdomain: tenantDomains.subdomain })
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, tenantId));
    const base =
      this.config.get('CLINIC_APP_URL', { infer: true }) ??
      (this.config.get('NODE_ENV') === 'production'
        ? `https://{subdomain}.${this.config.get('TENANT_BASE_DOMAIN')}`
        : 'http://{subdomain}.localhost:3002');
    return `${base.replace('{subdomain}', domain?.subdomain ?? '')}${path}`;
  }

  /** After commit; a failure is logged, never blocks billing. */
  async notify(notices: QuoteNotice[]) {
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
    const { supportEmail } = await this.platform.get('general');
    const { cabinets } = await this.platform.get('notifications');
    for (const notice of notices) {
      try {
        const [row] = await this.database.db
          .select({ quote: quotes, tenant: tenants })
          .from(quotes)
          .innerJoin(tenants, eq(tenants.id, quotes.tenantId))
          .where(eq(quotes.id, notice.quoteId));
        if (!row) continue;
        const { quote, tenant } = row;
        const href = `/tenants/${tenant.id}?tab=subscription`;
        if (notice.kind === 'announce') {
          await this.notifications.notify({
            kind: 'billing.quote.issued',
            severity: 'info',
            title: `Devis ${quote.number} envoyé`,
            body: `${tenant.name} — ${formatMad(quote.amount)}`,
            href,
            tenantId: tenant.id,
            permission: 'billing:read',
          });
          continue;
        }
        if (notice.kind === 'suspended') {
          await this.notifications.notify({
            kind: 'billing.tenant.suspended',
            severity: 'critical',
            title: 'Cabinet suspendu pour impayé',
            body: `${tenant.name} — devis ${quote.number}, ${formatMad(quote.amount)}`,
            href,
            tenantId: tenant.id,
            permission: 'tenants:read',
          });
          await this.alerts.send('invoiceOverdue', {
            subject: `Cabinet suspendu pour impayé — ${tenant.name}`,
            lines: [`Devis ${quote.number} : ${formatMad(quote.amount)}`],
            path: href,
          });
        }
        if (notice.kind === 'reminder' && !cabinets.invoiceOverdue) continue;
        await this.email.sendQuote({
          kind: notice.kind,
          email: tenant.email,
          name: tenant.responsibleName,
          tenantName: tenant.name,
          number: quote.number,
          description: quote.description,
          amount: quote.amount,
          dueAt: quote.dueAt,
          suspendOn: notice.suspendOn,
          bank,
          proofEmail:
            (settings.configured ? settings.email : undefined) ??
            supportEmail ??
            null,
          url: await this.appUrl(tenant.id, `/devis/${quote.id}`),
        });
      } catch (err) {
        this.logger.error(`Quote notice ${notice.kind} failed`, err);
      }
    }
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
}
