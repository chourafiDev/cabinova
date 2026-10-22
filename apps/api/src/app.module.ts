import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.js';
import { ConsultationsModule } from './consultations/consultations.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EmailModule } from './email/email.module.js';
import { HealthController } from './health/health.controller.js';
import { PatientsModule } from './patients/patients.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { TenantMiddleware } from './tenancy/tenant.middleware.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // 100 requests / minute / IP by default; tighten per route with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    EmailModule,
    TenancyModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    ConsultationsModule,
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Every route runs inside a tenant, except the platform health check.
    consumer.apply(TenantMiddleware).exclude('health').forRoutes('*path');
  }
}
