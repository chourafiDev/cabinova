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
import { isMedical } from '../auth/roles.js';
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
  WalkInDto,
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

  /** A patient without an appointment, straight into the waiting room. */
  @Activity('appointment.walk_in', 'appointment')
  @Post('walk-in')
  async walkIn(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Body() dto: WalkInDto,
  ) {
    const appointment = await this.appointments.walkIn(
      db,
      space.id,
      dto,
      user.id,
    );
    await this.notifications.appointmentChanged(
      db,
      appointment.id,
      'arrived',
      user.id,
    );
    return appointment;
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
      isMedical(user),
    );
    await this.notifications.appointmentChanged(db, id, dto.status, user.id);
    return appointment;
  }

  /** Left the waiting room without being seen: the visit is cancelled. */
  @Activity('appointment.left', 'appointment')
  @Post(':id/left')
  @HttpCode(200)
  async left(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const appointment = await this.appointments.left(db, space.id, id);
    await this.notifications.appointmentChanged(db, id, 'left', user.id);
    return appointment;
  }

  /** Came back the same day: into the waiting room again. */
  @Activity('appointment.return', 'appointment')
  @Post(':id/return')
  @HttpCode(200)
  async returned(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const appointment = await this.appointments.returned(db, space.id, id);
    await this.notifications.appointmentChanged(db, id, 'returned', user.id);
    return appointment;
  }
}
