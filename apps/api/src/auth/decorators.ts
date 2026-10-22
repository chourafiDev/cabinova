import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth.types.js';
import type { Permission } from './permissions.js';

export const IS_PUBLIC = 'isPublic';
export const REQUIRED_PERMISSIONS = 'requiredPermissions';

/** Route reachable without a session (the tenant is still resolved). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** The user needs every listed permission. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Request>().user as AuthUser,
);
