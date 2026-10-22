import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithTenant } from './tenant-context.js';
import { TenancyService } from './tenancy.service.js';

/**
 * Resolves the tenant from the request host (X-Forwarded-Host behind the
 * Next.js proxy, via Express "trust proxy") and blocks inactive tenants.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenancy: TenancyService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const tenant = await this.tenancy.resolveHost(req.hostname);
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Clinique introuvable.',
      });
    }
    if (tenant.status === 'suspended' || tenant.status === 'archived') {
      throw new ForbiddenException({
        code: 'TENANT_SUSPENDED',
        message: 'Cet espace est suspendu. Contactez le support Cabinova.',
      });
    }
    runWithTenant(tenant, next);
  }
}
