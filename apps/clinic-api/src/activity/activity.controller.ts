import { Controller, Get, Query } from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { assertOwner } from '../auth/roles.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { ActivityService } from './activity.service.js';
import { ListActivityQuery } from './dto.js';

/** Read-only, for the responsible doctor: no route edits the journal. */
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Query() query: ListActivityQuery,
  ) {
    assertOwner(user);
    return this.activity.list(db, query);
  }
}
