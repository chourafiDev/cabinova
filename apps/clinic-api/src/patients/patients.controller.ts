import {
  Body,
  Controller,
  Delete,
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
import {
  HomonymsQuery,
  ListPatientsQuery,
  AntecedentsDto,
  LabResultDto,
  PermanentNoteDto,
  MedicalProfileDto,
  PatientDto,
  VitalSignsDto,
} from './dto.js';
import { PatientsService } from './patients.service.js';
import { LabResultsService } from './lab-results.service.js';
import { VitalsService } from './vitals.service.js';

/** The current space's patients, for its staff; antécédents for doctors only. */
@UseGuards(SpaceGuard)
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patients: PatientsService,
    private readonly vitals: VitalsService,
    private readonly labResults: LabResultsService,
  ) {}

  @Get()
  list(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Query() query: ListPatientsQuery,
  ) {
    return this.patients.list(db, space.id, query);
  }

  /** Before ':id': the files a name being typed would duplicate. */
  @Get('homonyms')
  homonyms(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Query() query: HomonymsQuery,
  ) {
    return this.patients.homonyms(db, space.id, query);
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

  /** Constantes, for the whole staff. */
  @Get(':id/vitals')
  listVitals(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vitals.list(db, space.id, id);
  }

  @Activity('patient.vitals', 'patient')
  @Post(':id/vitals')
  addVitals(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VitalSignsDto,
  ) {
    return this.vitals.create(db, space.id, id, dto, user.id);
  }

  @Activity('patient.vitals_delete', 'patient')
  @Delete(':id/vitals/:vitalsId')
  removeVitals(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('vitalsId', ParseUUIDPipe) vitalsId: string,
  ) {
    return this.vitals.remove(db, space.id, id, vitalsId, user);
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

  /** Bilan biologique: the patient's results, newest first (doctors only). */
  @Get(':id/lab-results')
  listLabResults(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertMedical(user);
    return this.labResults.list(db, space.id, id);
  }

  @Activity('patient.lab_result', 'patient')
  @Post(':id/lab-results')
  addLabResult(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LabResultDto,
  ) {
    assertMedical(user);
    return this.labResults.create(db, space.id, id, dto, user.id);
  }

  @Activity('patient.lab_result_delete', 'patient')
  @Delete(':id/lab-results/:resultId')
  removeLabResult(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ) {
    assertMedical(user);
    return this.labResults.remove(db, space.id, id, resultId);
  }

  /** The permanent note alone (autosaved from the dossier). */
  @Activity('patient.medical_update', 'patient', { hourly: true })
  @Put(':id/permanent-note')
  savePermanentNote(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PermanentNoteDto,
  ) {
    assertMedical(user);
    return this.patients.savePermanentNote(db, space.id, id, dto.permanentNote ?? null, user.id);
  }

  /** The antécédents note alone (autosaved from the dossier): the structured profile is left as is. */
  @Activity('patient.medical_update', 'patient', { hourly: true })
  @Put(':id/antecedents')
  saveAntecedents(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AntecedentsDto,
  ) {
    assertMedical(user);
    return this.patients.saveAntecedents(db, space.id, id, dto.antecedents ?? null, user.id);
  }
}
