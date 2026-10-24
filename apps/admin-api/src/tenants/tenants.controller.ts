import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import {
  ChangeTenantStatusDto,
  CreateTenantDto,
  ListTenantAuditQuery,
  ListTenantsQuery,
  UpdateTenantDto,
} from './dto.js';
import type { AuditActor } from './tenant-audit.js';
import { TenantLifecycleService } from './tenant-lifecycle.service.js';
import { TenantsService } from './tenants.service.js';

const actorOf = (user: AuthUser, req: Request): AuditActor => ({
  userId: user.id,
  ip: req.ip,
});

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly lifecycle: TenantLifecycleService,
  ) {}

  @RequirePermissions('tenants:read')
  @Get()
  list(@Query() query: ListTenantsQuery) {
    return this.tenants.list(query);
  }

  @RequirePermissions('tenants:read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenants.get(id);
  }

  @RequirePermissions('tenants:write')
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenants.create(actorOf(user, req), dto);
  }

  @RequirePermissions('tenants:write')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenants.update(id, actorOf(user, req), dto);
  }

  @RequirePermissions('tenants:write')
  @Post(':id/status-changes')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: ChangeTenantStatusDto,
  ) {
    return this.lifecycle.request(id, actorOf(user, req), dto);
  }

  @RequirePermissions('tenants:write')
  @Delete(':id/status-changes/:changeId')
  @HttpCode(204)
  async cancelStatusChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('changeId', ParseUUIDPipe) changeId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.lifecycle.cancel(id, changeId, actorOf(user, req));
  }

  @RequirePermissions('tenants:read')
  @Get(':id/audit')
  audit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListTenantAuditQuery,
  ) {
    return this.tenants.listAudit(id, query);
  }
}
