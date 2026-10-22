import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import { CreateTenantDto, ListTenantsQuery } from './dto.js';
import { TenantsService } from './tenants.service.js';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

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
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateTenantDto) {
    return this.tenants.create(actor, dto);
  }
}
