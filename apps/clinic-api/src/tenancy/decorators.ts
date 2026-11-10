import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ClinicContext } from './tenancy.service.js';

/** The request's cabinet and its database pool (set by TenancyMiddleware). */
export const Clinic = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): ClinicContext =>
    ctx.switchToHttp().getRequest<Request>().clinic!,
);
