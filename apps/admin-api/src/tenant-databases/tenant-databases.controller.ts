import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuditActor } from '../audit/audit.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import { ProvisionTenantDto } from './dto.js';
import { ProvisioningService } from './provisioning.service.js';
import { TenantDatabasesService } from './tenant-databases.service.js';

const actorOf = (user: AuthUser, req: Request): AuditActor => ({
  userId: user.id,
  ip: req.ip,
});

/** Module 4 — Administration technique du multitenancy. */
@Controller()
export class TenantDatabasesController {
  constructor(
    private readonly databases: TenantDatabasesService,
    private readonly provisioning: ProvisioningService,
  ) {}

  @RequirePermissions('technical:read')
  @Get('tenant-databases')
  overview() {
    return this.databases.overview();
  }

  /** Global migration: every clinic behind the latest schema version. */
  @RequirePermissions('technical:write')
  @Post('tenant-databases/migrate')
  @HttpCode(200)
  migrateBehind(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.databases.migrateBehind(actorOf(user, req));
  }

  @RequirePermissions('technical:read')
  @Get('tenants/:id/database')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return {
      ...(await this.databases.get(id)),
      runs: await this.provisioning.runs(id),
    };
  }

  @RequirePermissions('technical:write')
  @Post('tenants/:id/provision')
  @HttpCode(202)
  provision(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: ProvisionTenantDto,
  ) {
    return this.provisioning.start(id, actorOf(user, req), dto);
  }

  @RequirePermissions('technical:write')
  @Post('tenants/:id/database/check')
  @HttpCode(200)
  check(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.databases.check(id, actorOf(user, req));
  }

  @RequirePermissions('technical:write')
  @Post('tenants/:id/database/migrate')
  @HttpCode(200)
  migrate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.databases.migrate(id, actorOf(user, req));
  }
}
