import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { assertMedical } from '../auth/roles.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import {
  CustomMedicationDto,
  OverrideDto,
  RenewalCheckDto,
  SearchMedicationsQuery,
  UpdateCustomMedicationDto,
} from './dto.js';
import { MedicationsService } from './medications.service.js';

/**
 * Medicines for the ordonnance (doctors only): the AMMPS list merged with
 * each doctor's own wording, favorites and own medicines — each doctor's
 * settings are theirs alone.
 */
@Controller('medications')
export class MedicationsController {
  constructor(private readonly medications: MedicationsService) {}

  @Get('search')
  search(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Query() { q }: SearchMedicationsQuery,
  ) {
    assertMedical(user);
    return this.medications.search(db, user.id, q);
  }

  @Get('favorites')
  favorites(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    assertMedical(user);
    return this.medications.favorites(db, user.id);
  }

  @Get('overrides')
  overrides(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    assertMedical(user);
    return this.medications.overrides(db, user.id);
  }

  @Put('ammps/:ammpsId/override')
  saveOverride(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('ammpsId', ParseIntPipe) ammpsId: number,
    @Body() dto: OverrideDto,
  ) {
    assertMedical(user);
    return this.medications.saveOverride(db, user.id, ammpsId, dto);
  }

  @Post('ammps/:ammpsId/override/accept-ammps')
  @HttpCode(200)
  acceptAmmps(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('ammpsId', ParseIntPipe) ammpsId: number,
  ) {
    assertMedical(user);
    return this.medications.acceptAmmps(db, user.id, ammpsId);
  }

  @Delete('ammps/:ammpsId/override')
  @HttpCode(204)
  async deleteOverride(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('ammpsId', ParseIntPipe) ammpsId: number,
  ) {
    assertMedical(user);
    await this.medications.deleteOverride(db, user.id, ammpsId);
  }

  @Get('custom')
  customList(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    assertMedical(user);
    return this.medications.customList(db, user.id);
  }

  @Post('custom')
  createCustom(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: CustomMedicationDto,
  ) {
    assertMedical(user);
    return this.medications.createCustom(db, user.id, dto);
  }

  @Patch('custom/:id')
  updateCustom(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomMedicationDto,
  ) {
    assertMedical(user);
    return this.medications.updateCustom(db, user.id, id, dto);
  }

  @Delete('custom/:id')
  @HttpCode(204)
  async deleteCustom(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertMedical(user);
    await this.medications.deleteCustom(db, user.id, id);
  }

  /** Before renewing an old ordonnance: what has been withdrawn since. */
  @Post('check-renewal')
  @HttpCode(200)
  checkRenewal(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: RenewalCheckDto,
  ) {
    assertMedical(user);
    return this.medications.checkRenewal(db, user.id, dto.items);
  }
}
