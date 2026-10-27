import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module.js';
import { BillingSettingsService } from './billing-settings.service.js';
import { BillingController } from './billing.controller.js';
import { BillingScheduler } from './billing.scheduler.js';
import { BillingService } from './billing.service.js';
import { CreditNotesService } from './credit-notes.service.js';
import { PromoCodesService } from './promo-codes.service.js';

@Module({
  imports: [TenantsModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingSettingsService,
    BillingScheduler,
    CreditNotesService,
    PromoCodesService,
  ],
})
export class BillingModule {}
