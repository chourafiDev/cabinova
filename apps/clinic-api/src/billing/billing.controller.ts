import { Controller, ForbiddenException, Get } from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { CatalogService } from '../database/catalog.module.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { nextInvoiceAmount } from './amount.js';

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
  pay_to: {
    companyName?: string;
    accountHolder?: string;
    bankName?: string;
    rib?: string;
    swift?: string;
  } | null;
};

@Controller('billing')
export class BillingController {
  constructor(private readonly catalog: CatalogService) {}

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
    if (user.role !== 'owner') {
      throw new ForbiddenException({
        code: 'OWNER_ONLY',
        message: 'Seul le médecin responsable gère l’abonnement.',
      });
    }
    const { rows } = await this.catalog.pool.query<Row>(
      `select p.name as plan, s.billing_period, s.status, s.current_period_end,
              s.price, s.discount_percent,
              pc.discount_percent as promo_percent, s.promo_invoices_left,
              i.number as invoice_number, i.amount as invoice_amount,
              i.due_at as invoice_due_at, i.status as invoice_status,
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
        where t.id = $1`,
      [tenant.id],
    );
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
      payTo,
    };
  }
}
