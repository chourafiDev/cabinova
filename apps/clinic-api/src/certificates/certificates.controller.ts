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
import { CertificatesService } from './certificates.service.js';
import { CertificateDto, CertificateModelDto } from './dto.js';

/** Certificats médicaux: written, printed and cancelled by doctors only. */
@UseGuards(SpaceGuard)
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  list(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Query('patientId', ParseUUIDPipe) patientId: string,
  ) {
    assertMedical(user);
    return this.certificates.list(db, space.id, patientId);
  }

  /**
   * A visit's certificates: read and printed by the whole staff (the front
   * desk hands them over); only doctors write or cancel them.
   */
  @Get('visit/:id')
  visit(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificates.forVisit(db, space.id, id);
  }

  @Activity('certificate.create', 'certificate')
  @Post()
  create(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Body() dto: CertificateDto,
  ) {
    assertMedical(user);
    return this.certificates.create(db, space.id, dto, user.id);
  }

  @Activity('certificate.cancel', 'certificate')
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertMedical(user);
    return this.certificates.cancel(db, space.id, id, user.id);
  }

  @Get(':id/print')
  print(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificates.print(db, space.id, id);
  }
}

/** Each doctor's own certificate models, shared by none. */
@Controller('certificate-models')
export class CertificateModelsController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  list(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    assertMedical(user);
    return this.certificates.models(db, user.id);
  }

  @Post()
  create(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: CertificateModelDto,
  ) {
    assertMedical(user);
    return this.certificates.createModel(db, user.id, dto);
  }

  @Put(':id')
  update(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CertificateModelDto,
  ) {
    assertMedical(user);
    return this.certificates.updateModel(db, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertMedical(user);
    return this.certificates.deleteModel(db, user.id, id);
  }
}
