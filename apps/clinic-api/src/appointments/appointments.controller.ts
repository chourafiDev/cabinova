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
import { Activity } from '../activity/activity.decorator.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { CurrentSpace, SpaceGuard } from '../spaces/space.guard.js';
import type { Space } from '../spaces/spaces.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
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
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly notifications: NotificationsService,
  ) {}

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

  @Activity('appointment.create', 'appointment')
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
  @Activity('appointment.update', 'appointment')
  @Put(':id')
  update(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppointmentDto,
  ) {
    return this.appointments.update(db, space.id, id, dto);
  }

  @Activity('appointment.status', 'appointment', {
    detail: (req) => (req.body as { status?: string }).status,
  })
  @Post(':id/status')
  @HttpCode(200)
  async setStatus(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    const appointment = await this.appointments.setStatus(
      db,
      space.id,
      id,
      dto.status,
    );
    await this.notifications.appointmentChanged(db, id, dto.status, user.id);
    return appointment;
  }
}
