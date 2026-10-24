import { Module } from '@nestjs/common';
import { BillingSettingsService } from './billing-settings.service.js';
import { BillingController } from './billing.controller.js';
import { BillingScheduler } from './billing.scheduler.js';
import { BillingService } from './billing.service.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingSettingsService, BillingScheduler],
})
export class BillingModule {}
