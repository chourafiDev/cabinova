import { Module } from '@nestjs/common';
import { TenantLifecycleScheduler } from './tenant-lifecycle.scheduler.js';
import { TenantLifecycleService } from './tenant-lifecycle.service.js';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantLifecycleService, TenantLifecycleScheduler],
  exports: [TenantLifecycleService],
})
export class TenantsModule {}
