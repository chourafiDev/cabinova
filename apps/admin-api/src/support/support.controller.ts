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
import type { AuditActor } from '../audit/audit.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import {
  AddMessageDto,
  CreateTicketDto,
  TicketsQuery,
  UpdateTicketDto,
} from './dto.js';
import { SupportService, type TicketViewer } from './support.service.js';

const actorOf = (user: AuthUser, req: Request): AuditActor => ({
  userId: user.id,
  ip: req.ip,
});

/** Without support:all, an agent sees their tickets and unassigned ones only. */
const viewerOf = (user: AuthUser): TicketViewer => ({
  id: user.id,
  all: user.permissions.includes('support:all'),
});

/** Support et assistance — tickets, incidents and the conversation with cabinets. */
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @RequirePermissions('support:read')
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.support.summary(viewerOf(user));
  }

  @RequirePermissions('support:read')
  @Get('agents')
  agents() {
    return this.support.agents();
  }

  @RequirePermissions('support:write')
  @Get('cabinets')
  cabinets() {
    return this.support.cabinets();
  }

  @RequirePermissions('support:read')
  @Get('tickets')
  list(@Query() query: TicketsQuery, @CurrentUser() user: AuthUser) {
    return this.support.list(query, viewerOf(user));
  }

  @RequirePermissions('support:read')
  @Get('tickets/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.support.get(id, viewerOf(user));
  }

  @RequirePermissions('support:write')
  @Post('tickets')
  create(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: CreateTicketDto,
  ) {
    return this.support.create(actorOf(user, req), dto);
  }

  @RequirePermissions('support:write')
  @Patch('tickets/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.support.update(actorOf(user, req), id, dto, viewerOf(user));
  }

  @RequirePermissions('support:write')
  @Post('tickets/:id/messages')
  addMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: AddMessageDto,
  ) {
    return this.support.addMessage(actorOf(user, req), id, dto, viewerOf(user));
  }
}
