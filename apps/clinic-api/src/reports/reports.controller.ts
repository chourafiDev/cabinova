import { Controller, Get, Query } from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { ReportsQuery } from './dto.js';
import { ReportsService } from './reports.service.js';

/** Statistiques: the responsible doctor and the doctors. */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  report(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Query() query: ReportsQuery,
  ) {
    return this.reports.report(db, user, query);
  }
}
