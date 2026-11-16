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
import { assertMedical } from '../auth/roles.js';
import { CurrentSpace, SpaceGuard } from '../spaces/space.guard.js';
import type { Space } from '../spaces/spaces.service.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { LabRequestBodyDto, LabRequestDto, LabRequestModelDto } from './dto.js';
import { LabRequestsService } from './lab-requests.service.js';

/** Bilans biologiques: written by doctors; printed by the whole staff (the desk hands them over). */
@UseGuards(SpaceGuard)
@Controller('lab-requests')
export class LabRequestsController {
  constructor(private readonly requests: LabRequestsService) {}

  @Get()
  list(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Query('patientId', ParseUUIDPipe) patientId: string,
  ) {
    assertMedical(user);
    return this.requests.list(db, space.id, patientId);
  }

  @Activity('lab_request.create', 'lab_request')
  @Post()
  create(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Body() dto: LabRequestDto,
  ) {
    assertMedical(user);
    return this.requests.create(db, space.id, dto, user.id);
  }

  @Activity('lab_request.update', 'lab_request')
  @Put(':id')
  update(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LabRequestBodyDto,
  ) {
    assertMedical(user);
    return this.requests.update(db, space.id, id, dto.body);
  }

  @Get(':id/print')
  print(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requests.print(db, space.id, id);
  }
}

/** Each doctor's own bilans, shared by none. */
@Controller('lab-request-models')
export class LabRequestModelsController {
  constructor(private readonly requests: LabRequestsService) {}

  @Get()
  list(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    assertMedical(user);
    return this.requests.models(db, user.id);
  }

  @Post()
  create(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: LabRequestModelDto,
  ) {
    assertMedical(user);
    return this.requests.createModel(db, user.id, dto);
  }

  @Put(':id')
  update(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LabRequestModelDto,
  ) {
    assertMedical(user);
    return this.requests.updateModel(db, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertMedical(user);
    return this.requests.deleteModel(db, user.id, id);
  }
}
