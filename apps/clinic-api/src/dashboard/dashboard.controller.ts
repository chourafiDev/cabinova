import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { CurrentSpace, SpaceGuard } from '../spaces/space.guard.js';
import { type Space, SpacesService } from '../spaces/spaces.service.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { DashboardService } from './dashboard.service.js';

@UseGuards(SpaceGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly spaces: SpacesService,
  ) {}

  /**
   * GET /dashboard — the current space; ?scope=all — every space added up,
   * with a line per space (the owner only).
   */
  @Get()
  async overview(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @CurrentSpace() space: Space,
    @Query('scope') scope?: string,
  ) {
    if (scope === 'all') {
      if (user.role !== 'owner') {
        throw new ForbiddenException({
          code: 'OWNER_ONLY',
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
        )),
      };
    }
    return {
      scope: 'space' as const,
      ...(await this.dashboard.overview(
        db,
        [space.id],
        true,
        user.role === 'owner',
      )),
    };
  }
}
