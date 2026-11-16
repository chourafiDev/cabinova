import {
  Body,
  Controller,
  Get,
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
import { LetterBodyDto, LetterDto, LettersQuery } from './dto.js';
import { LettersService } from './letters.service.js';

/** Lettres and comptes rendus: written by doctors; printed by the whole staff (the desk hands them over). */
@UseGuards(SpaceGuard)
@Controller('letters')
export class LettersController {
  constructor(private readonly letters: LettersService) {}

  @Get()
  list(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Query() query: LettersQuery,
  ) {
    assertMedical(user);
    return this.letters.list(db, space.id, query.patientId, query.kind ?? 'letter');
  }

  @Activity('letter.create', 'letter')
  @Post()
  create(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Body() dto: LetterDto,
  ) {
    assertMedical(user);
    return this.letters.create(db, space.id, dto, user.id);
  }

  @Activity('letter.update', 'letter')
  @Put(':id')
  update(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LetterBodyDto,
  ) {
    assertMedical(user);
    return this.letters.update(db, space.id, id, dto.body);
  }

  @Get(':id/print')
  print(
    @Clinic() { db }: ClinicContext,
    @CurrentSpace() space: Space,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.letters.print(db, space.id, id);
  }
}
