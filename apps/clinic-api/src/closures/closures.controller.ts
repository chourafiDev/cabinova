import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Activity } from '../activity/activity.decorator.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { SpaceGuard } from '../spaces/space.guard.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { ClosuresService } from './closures.service.js';
import { ClosureDto, ConflictsQuery, ListClosuresQuery } from './dto.js';

/** Congés et absences: everyone sees them; who changes them depends on whose days they are. */
@UseGuards(SpaceGuard)
@Controller('closures')
export class ClosuresController {
  constructor(private readonly closures: ClosuresService) {}

  @Get()
  list(@Clinic() { db }: ClinicContext, @Query() query: ListClosuresQuery) {
    return this.closures.list(db, query);
  }

  @Get('conflicts')
  conflicts(@Clinic() { db }: ClinicContext, @Query() query: ConflictsQuery) {
    return this.closures.conflicts(db, query);
  }

  @Activity('closure.create', undefined, {
    detail: (req) => (req.body as { kind?: string }).kind,
  })
  @Post()
  create(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: ClosureDto,
  ) {
    return this.closures.create(db, dto, user);
  }

  @Activity('closure.delete')
  @Delete(':id')
  remove(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.closures.remove(db, id, user);
  }
}
