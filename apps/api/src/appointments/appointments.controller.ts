import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, RequirePermissions } from '../auth/decorators.js';
import { AppointmentsService } from './appointments.service.js';
import {
  AppointmentDto,
  ListAppointmentsQuery,
  UpdateStatusDto,
} from './dto.js';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @RequirePermissions('appointments:read')
  @Get()
  list(@Query() query: ListAppointmentsQuery) {
    return this.appointments.list(query);
  }

  @RequirePermissions('appointments:read')
  @Get('practitioners')
  practitioners() {
    return this.appointments.practitioners();
  }

  @RequirePermissions('appointments:write')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: AppointmentDto) {
    return this.appointments.create(user, dto);
  }

  @RequirePermissions('appointments:write')
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppointmentDto,
  ) {
    return this.appointments.update(user, id, dto);
  }

  @RequirePermissions('appointments:write')
  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.appointments.setStatus(user, id, dto.status);
  }
}
