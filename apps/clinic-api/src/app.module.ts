import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityController } from './activity/activity.controller.js';
import { ActivityInterceptor } from './activity/activity.interceptor.js';
import { ActivityService } from './activity/activity.service.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppointmentsController } from './appointments/appointments.controller.js';
import { AppointmentsService } from './appointments/appointments.service.js';
import { TwoFactorService } from './auth/two-factor.service.js';
import { AuthController } from './auth/auth.controller.js';
import { SessionGuard } from './auth/auth.guard.js';
import { BillingController } from './billing/billing.controller.js';
import { QuotesService } from './billing/quotes.service.js';
import { AuthService } from './auth/auth.service.js';
import { ClinicController } from './clinic/clinic.controller.js';
import { ClinicService } from './clinic/clinic.service.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { DashboardService } from './dashboard/dashboard.service.js';
import { validateEnv } from './config/env.js';
import { CatalogModule } from './database/catalog.module.js';
import { MailService } from './mail/mail.service.js';
import { HealthController } from './health/health.controller.js';
import { NotificationsController } from './notifications/notifications.controller.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { OnboardingController } from './onboarding/onboarding.controller.js';
import { OnboardingService } from './onboarding/onboarding.service.js';
import { ActsController } from './payments/acts.controller.js';
import { PaymentsController } from './payments/payments.controller.js';
import { PaymentsService } from './payments/payments.service.js';
import { PatientsController } from './patients/patients.controller.js';
import { PatientsService } from './patients/patients.service.js';
import { CabinetService } from './settings/cabinet.service.js';
import { ReportsController } from './reports/reports.controller.js';
import { ReportsService } from './reports/reports.service.js';
import { SettingsController } from './settings/settings.controller.js';
import { SpaceGuard } from './spaces/space.guard.js';
import { SpacesController } from './spaces/spaces.controller.js';
import { SpacesService } from './spaces/spaces.service.js';
import { TeamController } from './team/team.controller.js';
import { TeamService } from './team/team.service.js';
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
    ActivityController,
    ClinicController,
    AuthController,
    BillingController,
    OnboardingController,
    NotificationsController,
    PatientsController,
    SpacesController,
    AppointmentsController,
    DashboardController,
    SettingsController,
    TeamController,
    ReportsController,
    ActsController,
    PaymentsController,
  ],
  providers: [
    TenancyService,
    ActivityService,
    AuthService,
    TwoFactorService,
    ClinicService,
    OnboardingService,
    NotificationsService,
    PatientsService,
    SpacesService,
    SpaceGuard,
    AppointmentsService,
    DashboardService,
    CabinetService,
    MailService,
    QuotesService,
    TeamService,
    ReportsService,
    PaymentsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware).exclude('health').forRoutes('*path');
  }
}
