import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import './auth.types.js';

export const IS_PUBLIC = 'isPublic';

/** No session needed (login, invitation, cabinet name). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_BEFORE_2FA = 'allowBefore2fa';

/** Reachable by someone who must still set up two-factor sign-in. */
export const AllowBeforeTwoFactor = () => SetMetadata(ALLOW_BEFORE_2FA, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Request>().user!,
);
