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
  InvitePlatformUserDto,
  ListPlatformUsersQuery,
  UpdatePlatformRoleDto,
  UpdatePlatformUserDto,
} from './dto.js';
import { PlatformRolesService } from './platform-roles.service.js';
import { PlatformUsersService } from './platform-users.service.js';

const actorOf = (user: AuthUser, req: Request) => ({ user, ip: req.ip });

/** Module 5 — Gestion des utilisateurs centraux et des permissions. */
@Controller()
export class PlatformUsersController {
  constructor(
    private readonly users: PlatformUsersService,
    private readonly roles: PlatformRolesService,
  ) {}

  @RequirePermissions('users:read')
  @Get('platform-users')
  list(@Query() query: ListPlatformUsersQuery) {
    return this.users.list(query);
  }

  @RequirePermissions('users:read')
  @Get('platform-users/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @RequirePermissions('users:read')
  @Get('platform-users/:id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.history(id);
  }

  @RequirePermissions('users:write')
  @Post('platform-users')
  invite(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: InvitePlatformUserDto,
  ) {
    return this.users.invite(actorOf(user, req), dto);
  }

  @RequirePermissions('users:write')
  @Patch('platform-users/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: UpdatePlatformUserDto,
  ) {
    return this.users.update(actorOf(user, req), id, dto);
  }

  @RequirePermissions('users:write')
  @Post('platform-users/:id/deactivate')
  @HttpCode(200)
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.users.setActive(actorOf(user, req), id, false);
  }

  @RequirePermissions('users:write')
  @Post('platform-users/:id/reactivate')
  @HttpCode(200)
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.users.setActive(actorOf(user, req), id, true);
  }

  /** New invitation or password-reset link (e-mailed, and returned to copy). */
  @RequirePermissions('users:write')
  @Post('platform-users/:id/link')
  @HttpCode(200)
  link(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.users.issueLink(actorOf(user, req), id);
  }

  @RequirePermissions('users:write')
  @Post('platform-users/:id/2fa/reset')
  @HttpCode(200)
  resetTwoFactor(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.users.resetTwoFactor(actorOf(user, req), id);
  }

  @RequirePermissions('users:write')
  @Delete('platform-users/:id/sessions')
  revokeSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.users.revokeSessions(actorOf(user, req), id);
  }

  @RequirePermissions('users:read')
  @Get('platform-roles')
  listRoles() {
    return this.roles.list();
  }

  @RequirePermissions('users:read')
  @Get('platform-permissions')
  permissions() {
    return this.roles.catalog();
  }

  @RequirePermissions('users:write')
  @Patch('platform-roles/:id')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: UpdatePlatformRoleDto,
  ) {
    return this.roles.update(actorOf(user, req), id, dto);
  }
}
