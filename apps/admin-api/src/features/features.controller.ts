import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuditActor } from '../audit/audit.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import { SetOverrideDto, UpdateFeatureDto } from './dto.js';
import { FeaturesService } from './features.service.js';

const actorOf = (user: AuthUser, req: Request): AuditActor => ({
  userId: user.id,
  ip: req.ip,
});

/** "Fonctionnalités et options" — catalog (from the code), kill switch, beta, per-cabinet exceptions. */
@Controller()
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @RequirePermissions('subscriptions:read')
  @Get('features')
  list() {
    return this.features.list();
  }

  @RequirePermissions('subscriptions:read')
  @Get('features/:key')
  get(@Param('key') key: string) {
    return this.features.get(key);
  }

  /** Only for a feature the code no longer implements ("Absente du code"). */
  @RequirePermissions('subscriptions:write')
  @Delete('features/:key')
  remove(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.features.remove(actorOf(user, req), key);
  }

  @RequirePermissions('subscriptions:write')
  @Patch('features/:key')
  update(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: UpdateFeatureDto,
  ) {
    return this.features.update(actorOf(user, req), key, dto);
  }

  @RequirePermissions('tenants:read')
  @Get('tenants/:id/features')
  forTenant(@Param('id', ParseUUIDPipe) id: string) {
    return this.features.forTenant(id);
  }

  @RequirePermissions('subscriptions:write')
  @Put('tenants/:id/features/:key')
  setOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: SetOverrideDto,
  ) {
    return this.features.setOverride(actorOf(user, req), id, key, dto);
  }

  @RequirePermissions('subscriptions:write')
  @Delete('tenants/:id/features/:key')
  @HttpCode(204)
  async removeOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.features.removeOverride(actorOf(user, req), id, key);
  }
}
