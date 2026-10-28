import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller.js';
import { SessionGuard } from './auth/auth.guard.js';
import { BillingController } from './billing/billing.controller.js';
import { AuthService } from './auth/auth.service.js';
import { ClinicController } from './clinic/clinic.controller.js';
import { ClinicService } from './clinic/clinic.service.js';
import { validateEnv } from './config/env.js';
import { CatalogModule } from './database/catalog.module.js';
import { HealthController } from './health/health.controller.js';
import { OnboardingController } from './onboarding/onboarding.controller.js';
import { OnboardingService } from './onboarding/onboarding.service.js';
import { TenancyMiddleware } from './tenancy/tenancy.middleware.js';
import { TenancyService } from './tenancy/tenancy.service.js';

// clinic-api: what a cabinet's staff use, at <subdomain>.cabinova.ma. Each
// request belongs to the cabinet of its host and only ever touches that
// cabinet's own database; the catalog is read for identity and offer.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Tests get their whole environment from their config, never .env.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    // Login and invitation routes are much stricter (@Throttle).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    CatalogModule,
  ],
  controllers: [
    HealthController,
    ClinicController,
    AuthController,
    BillingController,
    OnboardingController,
  ],
  providers: [
    TenancyService,
    AuthService,
    ClinicService,
    OnboardingService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware).exclude('health').forRoutes('*path');
  }
}
