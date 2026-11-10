import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Activity } from '../activity/activity.decorator.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { assertMedical } from '../auth/roles.js';
import { CurrentSpace, SpaceGuard } from '../spaces/space.guard.js';
import type { Space } from '../spaces/spaces.service.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { ConsultationsService } from './consultations.service.js';
import { ConsultationDto } from './dto.js';

/** The doctor's notes of each visit: doctors only, like the antécédents. */
@UseGuards(SpaceGuard)
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Get()
  history(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Query('patientId', ParseUUIDPipe) patientId: string,
  ) {
    assertMedical(user);
    return this.consultations.history(db, space.id, patientId);
  }

  @Get('visit/:id')
  visit(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertMedical(user);
    return this.consultations.visit(db, space.id, id);
  }

  /** Autosave: journaled once an hour per doctor and visit, never the content. */
  @Activity('consultation.save', 'appointment', { hourly: true })
  @Put('visit/:id')
  save(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConsultationDto,
  ) {
    assertMedical(user);
    return this.consultations.save(db, space.id, id, dto, user.id);
  }
}
