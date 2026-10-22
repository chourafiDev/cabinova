import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { currentTenant } from './tenant-context.js';

@Controller('tenants')
export class TenantsController {
  /** Branding for the login page of the clinic's subdomain. */
  @Public()
  @Get('current')
  current() {
    const { id, name, slug } = currentTenant();
    return { id, name, slug, logoUrl: null };
  }
}
