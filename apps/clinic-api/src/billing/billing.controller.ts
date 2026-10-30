import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { CatalogService } from '../database/catalog.module.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { nextInvoiceAmount } from './amount.js';
import { RequestQuoteDto } from './dto.js';
import { QUOTEABLE, QuotesService } from './quotes.service.js';

type Row = {
  plan: string | null;
  billing_period: 'monthly' | 'annual' | null;
  status: string | null;
  current_period_end: Date | null;
  price: number | null;
  discount_percent: number | null;
  promo_percent: number | null;
  promo_invoices_left: number | null;
  invoice_number: string | null;
  invoice_amount: number | null;
  invoice_due_at: Date | null;
  invoice_status: string | null;
  quoteable: boolean | null;
  quote_id: string | null;
  quote_number: string | null;
  quote_amount: number | null;
  quote_due_at: Date | null;
  quote_description: string | null;
  plan_key: string | null;
  pay_to: {
    companyName?: string;
    accountHolder?: string;
    bankName?: string;
    email?: string;
    rib?: string;
    swift?: string;
  } | null;
};

const assertOwner = (user: ClinicUser) => {
  if (user.role !== 'owner') {
    throw new ForbiddenException({
      code: 'OWNER_ONLY',
      message: 'Seul le médecin responsable gère l’abonnement.',
    });
  }
};

@Controller('billing')
export class BillingController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly quotes: QuotesService,
  ) {}

  /** The doctor picks an offer: the devis goes out by e-mail at once. */
  @Post('quote')
  @HttpCode(200)
  requestQuote(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Req() req: Request,
    @Body() dto: RequestQuoteDto,
  ) {
    assertOwner(user);
    return this.quotes.request(clinic, user, dto, req.ip);
  }

  @Get('quotes/:id')
  quote(
    @Clinic() { tenant }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertOwner(user);
    return this.quotes.quote(tenant.id, id);
  }

  @Get('invoices/:id')
  invoice(
    @Clinic() { tenant }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertOwner(user);
    return this.quotes.invoice(tenant.id, id);
  }

  /**
   * The responsible doctor's view of the subscription: offer and price
   * after the trial, the invoice waiting for payment, and where to send
   * the transfer. Staff don't see the cabinet's billing.
   */
  @Get('summary')
  async summary(
    @Clinic() { tenant }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    assertOwner(user);
    const [{ rows }, plans, invoices] = await Promise.all([
      this.catalog.pool.query<Row>(
        `select p.name as plan, p.key as plan_key, s.billing_period, s.status, s.current_period_end,
              s.price, s.discount_percent,
              pc.discount_percent as promo_percent, s.promo_invoices_left,
              i.number as invoice_number, i.amount as invoice_amount,
              i.due_at as invoice_due_at, i.status as invoice_status,
              ${QUOTEABLE} as quoteable,
              q.id as quote_id, q.number as quote_number, q.amount as quote_amount,
              q.due_at as quote_due_at, q.description as quote_description,
              (select value from platform_settings where key = 'billing') as pay_to
         from tenants t
         left join lateral (
           select * from subscriptions
            where tenant_id = t.id and status <> 'cancelled'
            order by started_at desc limit 1
         ) s on true
         left join subscription_plans p on p.id = s.plan_id
         left join promo_codes pc on pc.id = s.promo_code_id
         left join lateral (
           select * from invoices
            where tenant_id = t.id and status in ('billed', 'overdue')
            order by due_at asc limit 1
         ) i on true
         left join quotes q on q.tenant_id = t.id and q.status = 'pending'
        where t.id = $1`,
        [tenant.id],
      ),
      this.catalog.pool.query<{
        key: string;
        name: string;
        description: string | null;
        price_monthly: number;
        price_annual: number;
        max_doctors: number | null;
        max_secretaries: number | null;
        storage_quota_mb: number | null;
      }>(
        `select key, name, description, price_monthly, price_annual,
                max_doctors, max_secretaries, storage_quota_mb
           from subscription_plans where active order by sort_order, price_monthly`,
      ),
      this.catalog.pool.query<{
        id: string;
        number: string;
        amount: number;
        status: string;
        issued_at: Date;
      }>(
        `select id, number, amount, status, issued_at from invoices
          where tenant_id = $1 and status <> 'void'
          order by issued_at desc limit 12`,
        [tenant.id],
      ),
    ]);
    const r = rows[0];
    const payTo = r?.pay_to?.rib
      ? {
          companyName: r.pay_to.companyName ?? null,
          accountHolder: r.pay_to.accountHolder ?? null,
          bankName: r.pay_to.bankName ?? null,
          rib: r.pay_to.rib,
          swift: r.pay_to.swift ?? null,
        }
      : null;

    return {
      plan: r?.plan ?? null,
      billingPeriod: r?.billing_period ?? null,
      status: r?.status ?? null,
      trialEndsAt: r?.status === 'trialing' ? r.current_period_end : null,
      currentPeriodEnd: r?.current_period_end ?? null,
      nextAmount:
        r?.price != null
          ? nextInvoiceAmount(
              r.price,
              r.discount_percent ?? 0,
              r.promo_percent != null
                ? {
                    discountPercent: r.promo_percent,
                    invoicesLeft: r.promo_invoices_left,
                  }
                : null,
            )
          : null,
      openInvoice: r?.invoice_number
        ? {
            number: r.invoice_number,
            amount: r.invoice_amount,
            dueAt: r.invoice_due_at,
            status: r.invoice_status,
          }
        : null,
      /** On trial, nothing invoiced yet: the doctor can ask for a devis. */
      canRequestQuote: r?.quoteable === true,
      planKey: r?.plan_key ?? null,
      pendingQuote: r?.quote_id
        ? {
            id: r.quote_id,
            number: r.quote_number,
            amount: r.quote_amount,
            dueAt: r.quote_due_at,
            description: r.quote_description,
          }
        : null,
      plans: plans.rows.map((p) => ({
        key: p.key,
        name: p.name,
        description: p.description,
        priceMonthly: p.price_monthly,
        priceAnnual: p.price_annual,
        maxDoctors: p.max_doctors,
        maxSecretaries: p.max_secretaries,
        storageQuotaMb: p.storage_quota_mb,
      })),
      invoices: invoices.rows.map((i) => ({
        id: i.id,
        number: i.number,
        amount: i.amount,
        status: i.status,
        issuedAt: i.issued_at,
      })),
      proofEmail: await this.quotes.proofEmail(r?.pay_to ?? null),
      payTo,
    };
  }
}
