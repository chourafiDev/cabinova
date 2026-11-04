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
import { PrescriptionDto } from './dto.js';
import { PrescriptionsService } from './prescriptions.service.js';

/** Ordonnances: written and printed by doctors only, like the consultation. */
@UseGuards(SpaceGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get()
  history(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Query('patientId', ParseUUIDPipe) patientId: string,
  ) {
    assertMedical(user);
    return this.prescriptions.history(db, space.id, patientId);
  }

  @Get('medications')
  medications(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    assertMedical(user);
    return this.prescriptions.medications(db, user.id);
  }

  @Get('visit/:id')
  visit(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertMedical(user);
    return this.prescriptions.visit(db, space.id, id);
  }

  @Get('visit/:id/print')
  print(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertMedical(user);
    return this.prescriptions.print(db, space.id, id);
  }

  /** Autosave: journaled once an hour per doctor and visit, never the content. */
  @Activity('prescription.save', 'appointment', { hourly: true })
  @Put('visit/:id')
  save(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrescriptionDto,
  ) {
    assertMedical(user);
    return this.prescriptions.save(db, space.id, id, dto, user.id);
  }
}
