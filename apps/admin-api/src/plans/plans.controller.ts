import {
  Body,
  Controller,
  Get,
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
import { CreatePlanDto, ListPlansQuery, UpdatePlanDto } from './dto.js';
import { PlansService } from './plans.service.js';

@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @RequirePermissions('subscriptions:read')
  @Get()
  list(@Query() query: ListPlansQuery) {
    return this.plans.list(query);
  }

  @RequirePermissions('subscriptions:read')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.get(id);
  }

  @RequirePermissions('subscriptions:write')
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: CreatePlanDto,
  ) {
    return this.plans.create({ userId: user.id, ip: req.ip }, dto);
  }

  @RequirePermissions('subscriptions:write')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.update(id, { userId: user.id, ip: req.ip }, dto);
  }
}
