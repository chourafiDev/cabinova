import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { IS_PUBLIC } from './decorators.js';

/**
 * Global: every route needs a session of the request's cabinet unless
 * marked @Public(). Runs after TenancyMiddleware, so the session is looked
 * up in that cabinet's database only.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const user =
      typeof token === 'string' && token && req.clinic
        ? await this.auth.validateSession(req.clinic.db, token)
        : null;
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Connectez-vous pour continuer.',
      });
    }
    req.user = user;
    return true;
  }
}
