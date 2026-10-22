import { Module } from '@nestjs/common';
import { TenancyService } from './tenancy.service.js';
import { TenantMiddleware } from './tenant.middleware.js';
import { TenantsController } from './tenants.controller.js';

@Module({
  controllers: [TenantsController],
  providers: [TenancyService, TenantMiddleware],
  exports: [TenancyService, TenantMiddleware],
})
export class TenancyModule {}
