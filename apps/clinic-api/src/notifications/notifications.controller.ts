import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { NotificationsService } from './notifications.service.js';

/** The signed-in person's notifications: nobody reads another's. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Clinic() { db, tenant }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    return this.notifications.list(db, tenant.id, user);
  }

  @Post('read')
  @HttpCode(204)
  markAllRead(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    return this.notifications.markAllRead(db, user.id);
  }

  @Post(':id/read')
  @HttpCode(204)
  markRead(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(db, user.id, id);
  }
}
