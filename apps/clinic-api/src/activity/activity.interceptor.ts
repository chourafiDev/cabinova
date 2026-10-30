import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { from, mergeMap, type Observable } from 'rxjs';
import { ACTIVITY, type ActivityOptions } from './activity.decorator.js';
import { ActivityService } from './activity.service.js';

/** What a route returned, as the id of what it created. */
const paramId = ({ params: { id } }: Request) =>
  typeof id === 'string' ? id : undefined;

const idOf = (result: unknown) => {
  const r = result as { id?: string; member?: { id?: string } } | undefined;
  return r?.member?.id ?? r?.id;
};

/**
 * Journal entries for the routes marked @Activity. The target's name is
 * read before the route runs, so a deletion can still say what it deleted;
 * nothing is written if the route fails.
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activity: ActivityService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<ActivityOptions | undefined>(
      ACTIVITY,
      context.getHandler(),
    );
    const req = context.switchToHttp().getRequest<Request>();
    const db = req.clinic?.db;
    const user = req.user;
    if (!options || !db || !user || options.only?.(user) === false) {
      return next.handle();
    }
    return from(this.targetOf(req, options)).pipe(
      mergeMap((before) =>
        next.handle().pipe(
          mergeMap(async (result: unknown) => {
            const entityId = paramId(req) ?? idOf(result);
            const target =
              before ??
              (options.entity && entityId
                ? await this.safeDescribe(req, options, entityId)
                : null);
            const entry = {
              action: options.action,
              actor: { id: user.id, name: user.name },
              entity: options.entity,
              entityId,
              target,
              detail: options.detail?.(req),
              ip: req.ip,
            };
            await (options.hourly
              ? this.activity.recordHourly(db, entry)
              : this.activity.record(db, entry));
            return result;
          }),
        ),
      ),
    );
  }

  private async targetOf(req: Request, options: ActivityOptions) {
    const id = paramId(req);
    return options.entity && id ? this.safeDescribe(req, options, id) : null;
  }

  private async safeDescribe(
    req: Request,
    options: ActivityOptions,
    id: string,
  ) {
    try {
      return await this.activity.describe(req.clinic!.db, options.entity!, id);
    } catch {
      return null;
    }
  }
}
