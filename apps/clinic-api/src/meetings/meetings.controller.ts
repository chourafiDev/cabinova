import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Activity } from '../activity/activity.decorator.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { AddParticipantsDto, CreateMeetingDto } from './dto.js';
import { MeetingsService } from './meetings.service.js';

/** Réunions: the owner starts or plans them; each member sees theirs. */
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  list(@Clinic() clinic: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.meetings.list(clinic, user);
  }

  /** Polled by every page (the strip "Réunion en cours"). */
  @Get('current')
  current(@Clinic() clinic: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.meetings.current(clinic, user);
  }

  /** Who the owner can invite. */
  @Get('people')
  people(@Clinic() clinic: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.meetings.people(clinic, user);
  }

  // Each one creates a Google event and sends e-mails.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Activity('meeting.create', 'meeting')
  @Post()
  create(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: CreateMeetingDto,
  ) {
    return this.meetings.create(clinic, user, dto);
  }

  @Activity('meeting.invite', 'meeting')
  @Post(':id/participants')
  @HttpCode(200)
  addParticipants(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddParticipantsDto,
  ) {
    return this.meetings.addParticipants(clinic, user, id, dto);
  }

  @Activity('meeting.cancel', 'meeting')
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.meetings.cancel(clinic, user, id);
  }
}
