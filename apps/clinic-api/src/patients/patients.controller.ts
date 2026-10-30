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
import { assertMedical, isMedical } from '../auth/roles.js';
import { CurrentSpace, SpaceGuard } from '../spaces/space.guard.js';
import type { Space } from '../spaces/spaces.service.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { ListPatientsQuery, MedicalProfileDto, PatientDto } from './dto.js';
import { PatientsService } from './patients.service.js';

/** The current space's patients, for its staff; antécédents for doctors only. */
@UseGuards(SpaceGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  list(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Query() query: ListPatientsQuery,
  ) {
    return this.patients.list(db, space.id, query);
  }

  @Activity('patient.view', 'patient', { only: isMedical, hourly: true })
  @Get(':id')
  get(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patients.get(db, space.id, id, isMedical(user));
  }

  @Activity('patient.create', 'patient')
  @Post()
  create(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Body() dto: PatientDto,
  ) {
    return this.patients.create(db, space.id, dto, user.id);
  }

  @Activity('patient.update', 'patient')
  @Put(':id')
  update(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatientDto,
  ) {
    return this.patients.update(db, space.id, id, dto);
  }

  /** Health records are never deleted: archived, and restorable. */
  @Activity('patient.archive', 'patient')
  @Post(':id/archive')
  @HttpCode(200)
  archive(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patients.setArchived(db, space.id, id, true);
  }

  @Activity('patient.restore', 'patient')
  @Post(':id/restore')
  @HttpCode(200)
  restore(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patients.setArchived(db, space.id, id, false);
  }

  @Activity('patient.medical_update', 'patient')
  @Put(':id/medical-profile')
  saveMedicalProfile(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MedicalProfileDto,
  ) {
    assertMedical(user);
    return this.patients.saveMedicalProfile(db, space.id, id, dto, user.id);
  }
}
