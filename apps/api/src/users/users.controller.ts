import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import { InviteUserDto, UpdateAccessDto, UpdateStatusDto } from './dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequirePermissions('users:read')
  @Get()
  list() {
    return this.users.list();
  }

  @RequirePermissions('users:read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  /** Returns the invitation token; the app shows the link to share. */
  @RequirePermissions('users:write')
  @Post()
  invite(@Body() dto: InviteUserDto) {
    return this.users.invite(dto);
  }

  @RequirePermissions('users:write')
  @Post(':id/access-link')
  @HttpCode(200)
  accessLink(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.newAccessLink(id);
  }

  @RequirePermissions('users:write')
  @Patch(':id/status')
  @HttpCode(204)
  setStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.users.setActive(actor.id, id, dto.active);
  }

  @RequirePermissions('users:write')
  @Put(':id/access')
  updateAccess(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccessDto,
  ) {
    return this.users.updateAccess(actor.id, id, dto);
  }
}

@Controller()
export class AccessCatalogController {
  constructor(private readonly users: UsersService) {}

  @RequirePermissions('users:read')
  @Get('roles')
  roles() {
    return this.users.listRoles();
  }

  @RequirePermissions('users:read')
  @Get('permissions')
  permissions() {
    return this.users.listPermissions();
  }
}
