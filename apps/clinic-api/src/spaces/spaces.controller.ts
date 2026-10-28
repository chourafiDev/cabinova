import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
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
}
