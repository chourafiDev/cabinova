import {
  Body,
  Controller,
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
import {
  AttachSubscriptionDto,
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
  ) {}

  @RequirePermissions('billing:read')
  @Get('billing/invoices')
  invoices(@Query() query: ListInvoicesQuery) {
    return this.billing.listInvoices(query);
  }

  @RequirePermissions('billing:read')
  @Get('billing/invoices/:id')
  invoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.getInvoice(id);
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
  tenantBilling(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.tenantBilling(id);
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
