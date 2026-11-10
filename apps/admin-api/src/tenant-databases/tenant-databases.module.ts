import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { TenantsModule } from '../tenants/tenants.module.js';
import { NeonDatabaseProvider, TENANT_DB_PROVIDER } from './provider.js';
import { DataLifecycleService } from './data-lifecycle.service.js';
import { ProvisioningService } from './provisioning.service.js';
import { TenantConnections } from './tenant-connections.js';
import { TenantDatabasesController } from './tenant-databases.controller.js';
import { TenantDatabasesScheduler } from './tenant-databases.scheduler.js';
import { TenantDatabasesService } from './tenant-databases.service.js';

/**
 * Module 4. Without TENANT_SECRETS_KEY / TENANT_DB_ADMIN_URL the API still
 * boots; provisioning answers 503 until they're set.
 */
@Module({
  imports: [TenantsModule],
  controllers: [TenantDatabasesController],
  providers: [
    {
      provide: TENANT_DB_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = config.get('TENANT_DB_ADMIN_URL', { infer: true });
        return url ? new NeonDatabaseProvider(url) : null;
      },
    },
    TenantConnections,
    TenantDatabasesService,
    ProvisioningService,
    DataLifecycleService,
    TenantDatabasesScheduler,
  ],
})
export class TenantDatabasesModule {}
