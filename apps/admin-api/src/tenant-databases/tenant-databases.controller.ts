import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuditActor } from '../audit/audit.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import { DataLifecycleService } from './data-lifecycle.service.js';
import {
  ComplianceSettingsDto,
  DeleteTenantDataDto,
  ProvisionTenantDto,
} from './dto.js';
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
    private readonly lifecycle: DataLifecycleService,
  ) {}

  /** End of life: closure, retention end, exports, what blocks deletion. */
  @RequirePermissions('tenants:data')
  @Get('tenants/:id/data')
  dataStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.lifecycle.status(id);
  }

  /** The clinic's data as .json.gz; the fingerprint is recorded as proof. */
  @RequirePermissions('tenants:data')
  @Post('tenants/:id/data/export')
  @HttpCode(200)
  async exportData(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { file, filename, sha256 } = await this.lifecycle.export(
      id,
      actorOf(user, req),
    );
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Sha256', sha256);
    return new StreamableFile(file);
  }

  @RequirePermissions('tenants:data')
  @Post('tenants/:id/data/delete')
  @HttpCode(200)
  deleteData(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: DeleteTenantDataDto,
  ) {
    return this.lifecycle.delete(id, actorOf(user, req), dto.confirmName);
  }

  @RequirePermissions('security:read')
  @Get('security/compliance')
  async compliance() {
    return { retentionYears: await this.lifecycle.retentionYears() };
  }

  @RequirePermissions('settings:write')
  @Put('security/compliance')
  setCompliance(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: ComplianceSettingsDto,
  ) {
    return this.lifecycle.setRetentionYears(
      actorOf(user, req),
      dto.retentionYears,
    );
  }

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

  /** New invitation link for the responsible doctor (not yet signed up). */
  @RequirePermissions('technical:write')
  @Post('tenants/:id/database/invitation')
  @HttpCode(200)
  resendInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.provisioning.resendInvitation(id, actorOf(user, req));
  }

  /** The responsible doctor lost their phone and backup codes. */
  @RequirePermissions('technical:write')
  @Post('tenants/:id/owner-two-factor/reset')
  @HttpCode(200)
  resetOwnerTwoFactor(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.databases.resetOwnerTwoFactor(id, actorOf(user, req));
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
