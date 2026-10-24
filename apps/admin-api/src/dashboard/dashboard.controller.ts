import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermissions } from '../auth/decorators.js';
import { dashboardCsv } from './csv.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardQuery } from './dto.js';

/** Module 1 — Dashboard du Super Admin. */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermissions('dashboard:read')
  @Get()
  overview(@Query() query: DashboardQuery) {
    return this.dashboard.overview(query);
  }

  /** Same figures as CSV (opens in Excel). */
  @RequirePermissions('dashboard:read')
  @Get('export.csv')
  async export(
    @Query() query: DashboardQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const overview = await this.dashboard.overview(query);
    const day = overview.generatedAt.slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cabinova-statistiques-${day}.csv"`,
    );
    const { from, to, status, city, specialty, plan } = query;
    return dashboardCsv(overview, { from, to, status, city, specialty, plan });
  }
}
