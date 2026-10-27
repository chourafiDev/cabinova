import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuditActor } from '../audit/audit.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import { BillingSettingsService } from './billing-settings.service.js';
import { BillingService } from './billing.service.js';
import { CreditNotesService } from './credit-notes.service.js';
import { PromoCodesService } from './promo-codes.service.js';
import { invoiceAmount } from './periods.js';
import {
  ApplyPromoCodeDto,
  AttachSubscriptionDto,
  CreatePromoCodeDto,
  IssueCreditNoteDto,
  UpdatePromoCodeDto,
  BillingSettingsDto,
  CancelAtTermDto,
  ChangeSubscriptionDto,
  ListInvoicesQuery,
  RecordPaymentDto,
  VoidInvoiceDto,
} from './dto.js';

const actorOf = (user: AuthUser, req: Request): AuditActor => ({
  userId: user.id,
  ip: req.ip,
});

/** Module 3 — invoices paid by bank transfer, subscriptions, RIB settings. */
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly settings: BillingSettingsService,
    private readonly creditNotes: CreditNotesService,
    private readonly promos: PromoCodesService,
  ) {}

  @RequirePermissions('billing:read')
  @Get('billing/invoices')
  invoices(@Query() query: ListInvoicesQuery) {
    return this.billing.listInvoices(query);
  }

  @RequirePermissions('billing:read')
  @Get('billing/invoices/:id')
  async invoice(@Param('id', ParseUUIDPipe) id: string) {
    const [invoice, credit] = await Promise.all([
      this.billing.getInvoice(id),
      this.creditNotes.forInvoice(id),
    ]);
    return {
      ...invoice,
      creditNotes: credit.notes,
      creditable: credit.creditable,
    };
  }

  /** Avoir: refund or credit on a paid invoice. */
  @RequirePermissions('billing:write')
  @Post('billing/invoices/:id/credit-notes')
  issueCreditNote(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: IssueCreditNoteDto,
  ) {
    return this.creditNotes.issue(id, actorOf(user, req), dto);
  }

  @RequirePermissions('subscriptions:read')
  @Get('billing/promo-codes')
  promoCodes() {
    return this.promos.list();
  }

  @RequirePermissions('subscriptions:write')
  @Post('billing/promo-codes')
  createPromoCode(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: CreatePromoCodeDto,
  ) {
    return this.promos.create(actorOf(user, req), dto);
  }

  @RequirePermissions('subscriptions:write')
  @Patch('billing/promo-codes/:id')
  updatePromoCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: UpdatePromoCodeDto,
  ) {
    return this.promos.update(actorOf(user, req), id, dto);
  }

  @RequirePermissions('subscriptions:write')
  @Post('tenants/:id/promo-code')
  @HttpCode(200)
  applyPromoCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: ApplyPromoCodeDto,
  ) {
    return this.promos.apply(actorOf(user, req), id, dto);
  }

  @RequirePermissions('subscriptions:write')
  @Delete('tenants/:id/promo-code')
  removePromoCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.promos.remove(actorOf(user, req), id);
  }

  /** A transfer seen on the bank statement. */
  @RequirePermissions('billing:write')
  @Post('billing/invoices/:id/payments')
  @HttpCode(200)
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billing.recordPayment(id, actorOf(user, req), dto);
  }

  @RequirePermissions('billing:write')
  @Post('billing/invoices/:id/void')
  @HttpCode(200)
  void(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.billing.voidInvoice(id, actorOf(user, req), dto.reason);
  }

  @RequirePermissions('billing:read')
  @Get('billing/settings')
  getSettings() {
    return this.settings.get();
  }

  @RequirePermissions('billing:write')
  @Put('billing/settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: BillingSettingsDto,
  ) {
    return this.settings.update(actorOf(user, req), dto);
  }

  @RequirePermissions('tenants:read')
  @Get('tenants/:id/billing')
  async tenantBilling(@Param('id', ParseUUIDPipe) id: string) {
    const [billing, credit, promo, settings] = await Promise.all([
      this.billing.tenantBilling(id),
      this.creditNotes.forTenant(id),
      this.promos.forTenant(id),
      this.settings.get(),
    ]);
    const sub = billing.subscription;
    // What the next invoice will really ask: the better of the discount and
    // a running promo code, minus the credit (same rule as invoicing).
    const promoRuns = promo && (promo.invoicesLeft ?? 1) > 0;
    const nextAmount = sub
      ? Math.max(
          0,
          invoiceAmount(
            sub.price,
            Math.max(
              sub.discountPercent,
              promoRuns ? promo.discountPercent : 0,
            ),
          ) - credit.creditBalance,
        )
      : 0;
    return {
      ...billing,
      subscription: sub && {
        ...sub,
        listAmount: sub.nextAmount,
        nextAmount,
      },
      creditNotes: credit.notes,
      creditBalance: credit.creditBalance,
      promo,
      suspendAfterDays: settings.suspendAfterDays,
    };
  }

  @RequirePermissions('billing:write')
  @Post('tenants/:id/billing/invoices')
  issueNow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.billing.issueNow(id, actorOf(user, req));
  }

  @RequirePermissions('subscriptions:write')
  @Post('tenants/:id/subscription')
  attach(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: AttachSubscriptionDto,
  ) {
    return this.billing.attachSubscription(id, actorOf(user, req), dto);
  }

  @RequirePermissions('subscriptions:write')
  @Patch('tenants/:id/subscription')
  change(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: ChangeSubscriptionDto,
  ) {
    return this.billing.changeSubscription(id, actorOf(user, req), dto);
  }

  @RequirePermissions('subscriptions:write')
  @Put('tenants/:id/subscription/cancel-at-term')
  cancelAtTerm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: CancelAtTermDto,
  ) {
    return this.billing.setCancelAtTerm(
      id,
      actorOf(user, req),
      dto.cancelAtPeriodEnd,
    );
  }
}
