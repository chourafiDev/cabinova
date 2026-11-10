import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { BillingModule } from './billing/billing.module.js';
import { validateEnv } from './config/env.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DatabaseModule } from './database/database.module.js';
import { FeaturesModule } from './features/features.module.js';
import { EmailModule } from './email/email.module.js';
import { HealthController } from './health/health.controller.js';
import { PlansModule } from './plans/plans.module.js';
import { PlatformUsersModule } from './platform-users/platform-users.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { SearchModule } from './search/search.module.js';
import { SecurityModule } from './security/security.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { SupportModule } from './support/support.module.js';
import { TenantDatabasesModule } from './tenant-databases/tenant-databases.module.js';
import { TenantsModule } from './tenants/tenants.module.js';

// admin-api: the Super Admin control plane. Its own database is the catalog
// — no tenant resolution, no RLS. Each clinic's own database is provisioned,
// migrated and health-checked from here (Module 4), never read for its
// medical data.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Tests get their whole environment from vitest.e2e.config.ts, never
      // from a developer's .env (real Neon URLs, a live Resend key).
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    // 600 requests / minute / client IP by default: one dashboard page makes
    // several API calls (the Next server forwards the admin's IP). Sensitive
    // routes are much stricter with @Throttle (login: 5 / minute).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    DatabaseModule,
    CryptoModule,
    SettingsModule,
    NotificationsModule,
    EmailModule,
    AuthModule,
    TenantsModule,
    PlansModule,
    TenantDatabasesModule,
    PlatformUsersModule,
    DashboardModule,
    BillingModule,
    SupportModule,
    FeaturesModule,
    SecurityModule,
    SearchModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
