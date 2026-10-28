import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { CurrentSpace, SpaceGuard } from '../spaces/space.guard.js';
import type { Space } from '../spaces/spaces.service.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { AppointmentsService } from './appointments.service.js';
import {
  AppointmentDto,
  ListAppointmentsQuery,
  UpdateStatusDto,
} from './dto.js';

/** The current space's agenda. */
@UseGuards(SpaceGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Query() query: ListAppointmentsQuery,
  ) {
    return this.appointments.list(db, space.id, query);
  }

  @Get('practitioners')
  practitioners(@Clinic() { db }: ClinicContext, @CurrentSpace() space: Space) {
    return this.appointments.practitioners(db, space.id);
  }

  @Post()
  create(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Body() dto: AppointmentDto,
  ) {
    return this.appointments.create(db, space.id, dto, user.id);
  }

  /** Edit, move or resize (drag & drop sends the whole appointment). */
  @Put(':id')
  update(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppointmentDto,
  ) {
    return this.appointments.update(db, space.id, id, dto);
  }

  @Post(':id/status')
  @HttpCode(200)
  setStatus(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.appointments.setStatus(db, space.id, id, dto.status);
  }
}
