import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { AuthUser } from './auth.types.js';
import { IS_PUBLIC, REQUIRED_PERMISSIONS } from './decorators.js';
import type { PlatformPermission } from './permissions.js';

/** Global: every route needs a valid session unless marked @Public(). */
@Injectable()
export class SessionAuthGuard extends AuthGuard('session') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic || super.canActivate(context);
  }
}

/** Global: enforces @RequirePermissions(). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<PlatformPermission[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest<Request>().user as
      AuthUser | undefined;
    if (required.every((p) => user?.permissions.includes(p))) return true;
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: "Vous n'avez pas l'autorisation d'effectuer cette action.",
    });
  }
}

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
