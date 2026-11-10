import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { type Space, SpacesService } from './spaces.service.js';

declare module 'express' {
  interface Request {
    space?: Space;
    /** Every space this person may enter, read with the current one. */
    spaces?: Space[];
  }
}

/**
 * Routes on a space's data (patients, agenda…): resolves the person's
 * current space after SessionGuard. Every query of those routes is then
 * filtered by it — a record from another space answers 404.
 */
@Injectable()
export class SpaceGuard implements CanActivate {
  constructor(private readonly spaces: SpacesService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const { current, spaces } = await this.spaces.current(
      req.clinic!.db,
      req.user!,
    );
    req.space = current;
    req.spaces = spaces;
    return true;
  }
}

/** The request's current space (set by SpaceGuard). */
export const CurrentSpace = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Space =>
    ctx.switchToHttp().getRequest<Request>().space!,
);

/** The spaces this person may enter (set by SpaceGuard): no second lookup. */
export const AccessibleSpaces = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Space[] =>
    ctx.switchToHttp().getRequest<Request>().spaces!,
);
