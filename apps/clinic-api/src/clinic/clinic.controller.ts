import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';

@Controller('clinic')
export class ClinicController {
  /** The cabinet's public identity, for the login and invitation pages. */
  @Public()
  @Get()
  get(@Clinic() { tenant }: ClinicContext) {
    const { name, specialty, city, subdomain } = tenant;
    return { name, specialty, city, subdomain };
  }
}
