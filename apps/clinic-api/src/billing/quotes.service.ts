import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClinicUser } from '../auth/auth.types.js';
import type { Env } from '../config/env.js';
import { CatalogService } from '../database/catalog.module.js';
import { MailService } from '../mail/mail.service.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { nextInvoiceAmount } from './amount.js';
import type { RequestQuoteDto } from './dto.js';

type Issuer = {
  companyName?: string;
  address?: string;
  email?: string;
  ice?: string;
  rc?: string;
  taxId?: string;
  accountHolder?: string;
  bankName?: string;
  rib?: string;
  swift?: string;
  graceDays?: number;
};
type Sub = {
  id: string;
  plan_id: string;
  billing_period: 'monthly' | 'annual';
  status: string;
  price: number;
  discount_percent: number;
  current_period_end: Date | null;
  promo_code_id: string | null;
  promo_invoices_left: number | null;
  promo_percent: number | null;
  promo_code: string | null;
  promo_plan_keys: string[] | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GRACE_DAYS = 7;

/** A trial, or one ended with no facture ever issued: a devis comes next. */
export const QUOTEABLE = `(
  s.status = 'trialing'
  or (s.status = 'past_due' and not exists (
    select 1 from invoices i where i.subscription_id = s.id and i.status <> 'void'
  ))
)`;

const notFound = (what: string) =>
  new NotFoundException(`${what} introuvable.`);

/**
 * The doctor's side of the devis (admin-api billing/quotes.service.ts has
 * the team's). Same rules: the better of the commercial discount and a
 * running promo, one pending devis per cabinet, due after the trial's end.
 *
 * Production: the catalog role of clinic-api needs SELECT, INSERT and UPDATE
 * on `quotes`, USAGE on `quote_number_seq`, and INSERT on
 * `platform_audit_logs`.
 */
@Injectable()
export class QuotesService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Devis for the chosen offer, e-mailed at once. Asking again for the same
   * terms sends the waiting devis again; other terms replace it.
   */
  async request(
    { tenant }: ClinicContext,
    user: ClinicUser,
    dto: RequestQuoteDto,
    ip: string | undefined,
  ) {
    const client = await this.catalog.pool.connect();
    let quote: {
      id: string;
      number: string;
      description: string;
      amount: number;
      due_at: Date;
    };
    let issuer: Issuer;
    try {
      await client.query('begin');
      const { rows: subs } = await client.query<Sub>(
        `select s.id, s.plan_id, s.billing_period, s.status, s.price,
                s.discount_percent, s.current_period_end, s.promo_code_id,
                s.promo_invoices_left, pc.discount_percent as promo_percent,
                pc.code as promo_code, pc.plan_keys as promo_plan_keys
           from subscriptions s
           left join promo_codes pc on pc.id = s.promo_code_id
          where s.tenant_id = $1 and s.status <> 'cancelled' and ${QUOTEABLE}
            for update of s`,
        [tenant.id],
      );
      const sub = subs[0];
      if (!sub) {
        throw new ConflictException({
          code: 'NOT_ON_TRIAL',
          message: 'Votre abonnement est déjà en cours.',
        });
      }
      const { rows: plans } = await client.query<{
        id: string;
        key: string;
        name: string;
        price_monthly: number;
        price_annual: number;
      }>(
        `select id, key, name, price_monthly, price_annual
           from subscription_plans where key = $1 and active`,
        [dto.planKey],
      );
      const plan = plans[0];
      if (!plan) {
        throw new BadRequestException({
          code: 'PLAN_UNAVAILABLE',
          message: "Cette offre n'existe pas ou n'est plus proposée.",
        });
      }

      // The price kept by the subscription, unless the offer changes.
      const sameTerms =
        plan.id === sub.plan_id && dto.billingPeriod === sub.billing_period;
      const price = sameTerms
        ? sub.price
        : dto.billingPeriod === 'annual'
          ? plan.price_annual
          : plan.price_monthly;
      const promoApplies =
        sub.promo_percent !== null &&
        (sub.promo_invoices_left ?? 1) > 0 &&
        (!sub.promo_plan_keys?.length ||
          sub.promo_plan_keys.includes(plan.key));
      const usePromo =
        promoApplies && sub.promo_percent! > sub.discount_percent;
      const discount = usePromo ? sub.promo_percent! : sub.discount_percent;
      const amount = nextInvoiceAmount(price, discount, null);
      const description =
        `Abonnement ${plan.name} — ${dto.billingPeriod === 'annual' ? 'annuel' : 'mensuel'}` +
        (discount ? ` (remise ${discount} %)` : '') +
        (usePromo ? ` — code ${sub.promo_code}` : '');

      const { rows: settings } = await client.query<{ value: Issuer }>(
        `select value from platform_settings where key = 'billing'`,
      );
      issuer = settings[0]?.value ?? {};

      const { rows: pending } = await client.query<
        typeof quote & {
          plan_id: string;
          billing_period: string;
        }
      >(
        `select id, number, description, amount, due_at, plan_id, billing_period
           from quotes where tenant_id = $1 and status = 'pending' for update`,
        [tenant.id],
      );
      const waiting = pending[0];
      const same =
        waiting &&
        waiting.plan_id === plan.id &&
        waiting.billing_period === dto.billingPeriod &&
        waiting.amount === amount;
      if (same) {
        quote = waiting;
      } else {
        if (waiting) {
          await client.query(
            `update quotes set status = 'void',
                    void_reason = 'Remplacé par un nouveau devis', updated_at = now()
              where id = $1`,
            [waiting.id],
          );
        }
        const now = new Date();
        const start =
          sub.current_period_end && sub.current_period_end > now
            ? sub.current_period_end
            : now;
        const graceDays = issuer.graceDays ?? DEFAULT_GRACE_DAYS;
        const { rows: seq } = await client.query<{ n: string }>(
          `select nextval('quote_number_seq') as n`,
        );
        const number = `D-${now.getUTCFullYear()}-${seq[0].n.padStart(6, '0')}`;
        const { rows: created } = await client.query<typeof quote>(
          `insert into quotes
             (number, tenant_id, subscription_id, plan_id, billing_period, price,
              discount_percent, amount, description, source, issued_at, due_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'request', $10, $11)
           returning id, number, description, amount, due_at`,
          [
            number,
            tenant.id,
            sub.id,
            plan.id,
            dto.billingPeriod,
            price,
            discount,
            amount,
            description,
            now,
            new Date(start.getTime() + graceDays * DAY_MS),
          ],
        );
        quote = created[0];
        await client.query(
          `insert into platform_audit_logs
             (user_id, tenant_id, entity, entity_id, action, metadata, ip)
           values (null, $1, 'tenant', $1, 'billing.quote.issue', $2, $3)`,
          [
            tenant.id,
            JSON.stringify({
              quote: number,
              amount,
              source: 'clinic',
              by: { id: user.id, name: user.name, email: user.email },
            }),
            ip ?? null,
          ],
        );
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }

    const delivery = await this.send(tenant.id, quote, issuer);
    return { id: quote.id, number: quote.number, delivery };
  }

  /** The devis as a document. */
  async quote(tenantId: string, id: string) {
    const { rows } = await this.catalog.pool.query(
      `select q.id, q.number, q.description, q.amount, q.status, q.issued_at,
              q.due_at, q.paid_at, q.invoice_id, q.billing_period, q.price,
              q.discount_percent, p.name as plan
         from quotes q
         join subscription_plans p on p.id = q.plan_id
        where q.id = $1 and q.tenant_id = $2`,
      [id, tenantId],
    );
    const q = rows[0];
    if (!q) throw notFound('Devis');
    return {
      id: q.id,
      number: q.number,
      description: q.description,
      amount: q.amount,
      price: q.price,
      discountPercent: q.discount_percent,
      plan: q.plan,
      billingPeriod: q.billing_period,
      status: q.status,
      issuedAt: q.issued_at,
      dueAt: q.due_at,
      paidAt: q.paid_at,
      invoiceId: q.invoice_id,
      ...(await this.parties(tenantId)),
    };
  }

  /** A facture as a document. */
  async invoice(tenantId: string, id: string) {
    const { rows } = await this.catalog.pool.query(
      `select id, number, description, amount, credit_applied, status,
              issued_at, due_at, paid_at, period_start, period_end
         from invoices where id = $1 and tenant_id = $2`,
      [id, tenantId],
    );
    const i = rows[0];
    if (!i) throw notFound('Facture');
    const { rows: payments } = await this.catalog.pool.query(
      `select id, amount, received_at, reference from invoice_payments
        where invoice_id = $1 order by received_at`,
      [id],
    );
    return {
      id: i.id,
      number: i.number,
      description: i.description,
      amount: i.amount,
      creditApplied: i.credit_applied,
      status: i.status,
      issuedAt: i.issued_at,
      dueAt: i.due_at,
      paidAt: i.paid_at,
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        receivedAt: p.received_at,
        reference: p.reference,
      })),
      ...(await this.parties(tenantId)),
    };
  }

  /** Where the proof of transfer goes; null = reply to the e-mail. */
  async proofEmail(issuer: Issuer | null) {
    return issuer?.email ?? (await this.mail.supportEmail());
  }

  private async parties(tenantId: string) {
    const { rows } = await this.catalog.pool.query<{
      name: string;
      legal_name: string | null;
      responsible_name: string;
      address: string | null;
      city: string | null;
      email: string;
      issuer: Issuer | null;
    }>(
      `select name, legal_name, responsible_name, address, city, email,
              (select value from platform_settings where key = 'billing') as issuer
         from tenants where id = $1`,
      [tenantId],
    );
    const t = rows[0];
    const i = t.issuer;
    return {
      cabinet: {
        name: t.name,
        legalName: t.legal_name,
        responsibleName: t.responsible_name,
        address: t.address,
        city: t.city,
        email: t.email,
      },
      issuer: i?.rib
        ? {
            companyName: i.companyName ?? null,
            address: i.address ?? null,
            email: i.email ?? null,
            ice: i.ice ?? null,
            rc: i.rc ?? null,
            taxId: i.taxId ?? null,
            accountHolder: i.accountHolder ?? null,
            bankName: i.bankName ?? null,
            rib: i.rib,
            swift: i.swift ?? null,
          }
        : null,
      proofEmail: await this.proofEmail(i),
    };
  }

  private async send(
    tenantId: string,
    quote: {
      id: string;
      number: string;
      description: string;
      amount: number;
      due_at: Date;
    },
    issuer: Issuer,
  ) {
    const { rows } = await this.catalog.pool.query<{
      name: string;
      responsible_name: string;
      email: string;
      subdomain: string;
    }>(
      `select t.name, t.responsible_name, t.email, d.subdomain
         from tenants t
         join tenant_domains d on d.tenant_id = t.id
        where t.id = $1`,
      [tenantId],
    );
    const t = rows[0];
    const base =
      this.config.get('CLINIC_APP_URL', { infer: true }) ??
      (this.config.get('NODE_ENV') === 'production'
        ? `https://{subdomain}.${this.config.get('TENANT_BASE_DOMAIN')}`
        : 'http://{subdomain}.localhost:3002');
    return this.mail.sendQuote({
      kind: 'request',
      email: t.email,
      name: t.responsible_name,
      tenantName: t.name,
      number: quote.number,
      description: quote.description,
      amount: quote.amount,
      dueAt: quote.due_at,
      bank: issuer.rib
        ? {
            accountHolder: issuer.accountHolder ?? '',
            bankName: issuer.bankName ?? '',
            rib: issuer.rib,
            swift: issuer.swift ?? null,
          }
        : null,
      proofEmail: await this.proofEmail(issuer),
      url: `${base.replace('{subdomain}', t.subdomain)}/devis/${quote.id}`,
    });
  }
}
