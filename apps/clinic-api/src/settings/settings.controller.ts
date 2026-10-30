import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { Activity } from '../activity/activity.decorator.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { assertOwner } from '../auth/roles.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { CabinetService } from './cabinet.service.js';
import {
  ChangePasswordDto,
  UpdateAgendaSettingsDto,
  UpdateCabinetDto,
  UpdateProfileDto,
} from './dto.js';

/**
 * Paramètres: everyone manages their own profile, password and devices;
 * the cabinet's identity and agenda settings are the owner's.
 */
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly auth: AuthService,
    private readonly cabinet: CabinetService,
  ) {}

  @Put('profile')
  async updateProfile(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const { rows } = await db.query<{ name: string; email: string }>(
      `update users set name = $2, updated_at = now() where id = $1
       returning name, email`,
      [user.id, dto.name],
    );
    return rows[0];
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Activity('auth.password_change')
  @Put('password')
  @HttpCode(204)
  async changePassword(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: ChangePasswordDto,
  ) {
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException({
        code: 'SAME_PASSWORD',
        message: 'Le nouveau mot de passe doit être différent de l’actuel.',
      });
    }
    const changed = await this.auth.changePassword(
      db,
      user,
      dto.currentPassword,
      dto.newPassword,
    );
    if (!changed) {
      throw new BadRequestException({
        code: 'WRONG_PASSWORD',
        message: 'Mot de passe actuel incorrect.',
      });
    }
  }

  @Get('sessions')
  sessions(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.auth.listSessions(db, user);
  }

  /** Signs out every other device. */
  @Delete('sessions')
  async revokeOthers(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    return { revoked: await this.auth.revokeOtherSessions(db, user) };
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!(await this.auth.revokeOwnSession(db, user, id))) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session introuvable.',
      });
    }
  }

  @Get('cabinet')
  getCabinet(
    @Clinic() { tenant }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    assertOwner(user);
    return this.cabinet.get(tenant.id);
  }

  @Activity('settings.cabinet')
  @Put('cabinet')
  updateCabinet(
    @Clinic() { tenant, db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: UpdateCabinetDto,
    @Req() req: Request,
  ) {
    assertOwner(user);
    return this.cabinet.update(tenant.id, db, user, dto, req.ip);
  }

  /** Read by everyone: the booking form pre-selects this duration. */
  @Get('agenda')
  async agenda(@Clinic() { db }: ClinicContext) {
    const { rows } = await db.query<{ defaultAppointmentMinutes: number }>(
      `select default_appointment_minutes as "defaultAppointmentMinutes"
         from clinic_settings where id = 1`,
    );
    return rows[0] ?? { defaultAppointmentMinutes: 30 };
  }

  @Activity('settings.agenda')
  @Put('agenda')
  async updateAgenda(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: UpdateAgendaSettingsDto,
  ) {
    assertOwner(user);
    await db.query(
      `update clinic_settings set default_appointment_minutes = $1,
              updated_at = now() where id = 1`,
      [dto.defaultAppointmentMinutes],
    );
    return { defaultAppointmentMinutes: dto.defaultAppointmentMinutes };
  }
}
