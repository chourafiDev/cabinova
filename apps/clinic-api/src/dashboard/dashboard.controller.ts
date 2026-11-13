import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, Matches } from 'class-validator';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { addDays, daysBetween, MAX_DAYS, today } from '../reports/period.js';
import { CurrentSpace, SpaceGuard } from '../spaces/space.guard.js';
import { type Space, SpacesService } from '../spaces/spaces.service.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { DashboardService } from './dashboard.service.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /dashboard: the space(s) and the period (Moroccan days). */
export class DashboardQuery {
  /** "all": every space added up (the owner only). */
  @IsOptional()
  @IsIn(['all'])
  scope?: 'all';

  /** First day, included (default: 6 days before `to`). */
  @IsOptional()
  @Matches(DATE, { message: 'Date invalide (AAAA-MM-JJ).' })
  from?: string;

  /** Last day, included (default: today). */
  @IsOptional()
  @Matches(DATE, { message: 'Date invalide (AAAA-MM-JJ).' })
  to?: string;
}

@UseGuards(SpaceGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly spaces: SpacesService,
  ) {}

  /**
   * GET /dashboard — the current space; ?scope=all — every space added up,
   * with a line per space (the owner only). ?from&to: the period of the
   * figures and the chart (the last 7 days by default); today's list and
   * waiting room stay on today.
   */
  @Get()
  async overview(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @CurrentSpace() space: Space,
    @Query() query: DashboardQuery,
  ) {
    const to = query.to ?? today();
    const from = query.from ?? addDays(to, -6);
    const days = daysBetween(from, to);
    if (days < 1 || days > MAX_DAYS) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        key: 'INVALID_RANGE',
        params: { max: MAX_DAYS },
        message: `Choisissez une période d’un jour à ${MAX_DAYS} jours.`,
      });
    }
    const owner = user.role === 'owner';
    if (query.scope === 'all') {
      if (!owner) {
        throw new ForbiddenException({
          code: 'OWNER_ONLY',
          key: 'OWNER_ONLY_SPACES',
          message:
            'La vue de tous les espaces est réservée au médecin responsable.',
        });
      }
      const all = await this.spaces.accessible(db, user);
      return {
        scope: 'all' as const,
        ...(await this.dashboard.overview(
          db,
          all.map((s) => s.id),
          false,
          true,
          { from, to },
        )),
      };
    }
    return {
      scope: 'space' as const,
      ...(await this.dashboard.overview(db, [space.id], true, owner, {
        from,
        to,
      })),
    };
  }
}
