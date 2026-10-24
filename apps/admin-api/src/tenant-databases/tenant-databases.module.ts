import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { TenantsModule } from '../tenants/tenants.module.js';
import { NeonDatabaseProvider, TENANT_DB_PROVIDER } from './provider.js';
import { ProvisioningService } from './provisioning.service.js';
import { SecretBox } from './secret-box.js';
import { SECRET_BOX, TenantConnections } from './tenant-connections.js';
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
      provide: SECRET_BOX,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const key = config.get('TENANT_SECRETS_KEY', { infer: true });
        return key
          ? SecretBox.fromEnv(
              key,
              config.get('TENANT_SECRETS_KEY_VERSION'),
              config.get('TENANT_SECRETS_PREVIOUS_KEYS', { infer: true }),
            )
          : null;
      },
    },
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
    TenantDatabasesScheduler,
  ],
})
export class TenantDatabasesModule {}
