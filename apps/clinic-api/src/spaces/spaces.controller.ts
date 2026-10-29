import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { OpeningHoursDto } from '../settings/dto.js';
import { CreateSpaceDto, SwitchSpaceDto } from './dto.js';
import { SpacesService } from './spaces.service.js';

@Controller('spaces')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  /** The spaces this person may enter, and the current one. */
  @Get()
  list(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.spaces.current(db, user);
  }

  /** Work in another space (remembered across devices). */
  @Put('current')
  switch(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: SwitchSpaceDto,
  ) {
    return this.spaces.switchTo(db, user, dto.spaceId);
  }

  @Post()
  create(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: CreateSpaceDto,
  ) {
    return this.spaces.create(db, user, dto);
  }

  /** Owner (Paramètres › Espaces): all spaces, closed ones included. */
  @Get('manage')
  manage(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.spaces.manage(db, user);
  }

  @Put(':id')
  update(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSpaceDto,
  ) {
    return this.spaces.update(db, user, id, dto);
  }

  @Put(':id/hours')
  setHours(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OpeningHoursDto,
  ) {
    return this.spaces.setOpeningHours(db, user, id, dto.openingHours);
  }

  @Post(':id/close')
  @HttpCode(200)
  close(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.spaces.setActive(db, user, id, false);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  reopen(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.spaces.setActive(db, user, id, true);
  }
}
