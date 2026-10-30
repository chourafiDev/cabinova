import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Activity } from '../activity/activity.decorator.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { CurrentSpace, SpaceGuard } from '../spaces/space.guard.js';
import type { Space } from '../spaces/spaces.service.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import {
  CancelPaymentDto,
  CashCloseDto,
  CheckoutDto,
  PaymentsQuery,
  RefundDto,
} from './dto.js';
import { PaymentsService } from './payments.service.js';

/**
 * Encaissements in the current space: a visit's account and checkout,
 * receipts, cancellations, refunds, the desk's day and its close; the
 * owner's history and closes across spaces.
 */
@UseGuards(SpaceGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('appointments/:id/account')
  account(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.account(db, space.id, id);
  }

  @Activity('payment.checkout', 'appointment')
  @Post('appointments/:id/checkout')
  @HttpCode(200)
  checkout(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.payments.checkout(db, user, space.id, id, dto);
  }

  @Get('patients/:id/account')
  patientAccount(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.patientAccount(db, space.id, id);
  }

  @Activity('payment.cancel', 'payment')
  @Post('payments/:id/cancel')
  @HttpCode(200)
  cancel(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPaymentDto,
  ) {
    return this.payments.cancel(db, user, space.id, id, dto.reason);
  }

  @Activity('payment.refund', 'charge')
  @Post('charges/:id/refunds')
  @HttpCode(200)
  refund(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundDto,
  ) {
    return this.payments.refund(db, user, space.id, id, dto);
  }

  @Get('payments/:id/receipt')
  receipt(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.receipt(db, user, id);
  }

  @Get('cashier/today')
  desk(@Clinic() { db }: ClinicContext, @CurrentSpace() space: Space) {
    return this.payments.desk(db, space.id);
  }

  @Activity('cashier.close')
  @Post('cashier/close')
  @HttpCode(200)
  close(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @CurrentSpace() space: Space,
    @Body() dto: CashCloseDto,
  ) {
    return this.payments.close(db, user, space.id, dto);
  }

  @Get('payments')
  history(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Query() query: PaymentsQuery,
  ) {
    return this.payments.history(db, user, query);
  }

  @Get('cashier/closes')
  closes(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Query() query: PaymentsQuery,
  ) {
    return this.payments.closes(db, user, query);
  }
}
