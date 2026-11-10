import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { type ClinicContext, TenancyService } from './tenancy.service.js';

declare module 'express' {
  interface Request {
    clinic?: ClinicContext;
  }
}

/**
 * Every clinic route: the cabinet comes from the host (X-Forwarded-Host
 * behind the Next.js proxy, via "trust proxy"), never from the client's
 * body or a header it could choose.
 */
@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(private readonly tenancy: TenancyService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    req.clinic = await this.tenancy.resolve(req.hostname);
    next();
  }
}
