import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Activity } from '../activity/activity.decorator.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { AuthService } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators.js';
import { assertOwner } from '../auth/roles.js';
import { TwoFactorService } from '../auth/two-factor.service.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import {
  InviteMemberDto,
  RequireTwoFactorDto,
  UpdateMemberDto,
} from './dto.js';
import { TeamService } from './team.service.js';

/** Équipe: the responsible doctor manages the cabinet's staff. */
@Controller('team')
export class TeamController {
  constructor(
    private readonly team: TeamService,
    private readonly twoFactor: TwoFactorService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list(@Clinic() clinic: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.team.list(clinic, user);
  }

  /** Sends the invitation e-mail; the link is also returned to copy. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Activity('team.invite', 'member')
  @Post()
  invite(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.team.invite(clinic, user, dto);
  }

  /** Sessions actives: every signed-in device of the cabinet. */
  @Get('sessions')
  sessions(@Clinic() { db }: ClinicContext, @CurrentUser() user: ClinicUser) {
    assertOwner(user);
    return this.auth.listTeamSessions(db, user);
  }

  @Activity('team.session_revoke', 'session')
  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertOwner(user);
    if (!(await this.auth.revokeTeamSession(db, user, id))) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session introuvable.',
      });
    }
  }

  /** Signs a member out everywhere; for oneself, Mon profil does it. */
  @Activity('team.sessions_revoke', 'member')
  @Post(':id/sessions/revoke')
  @HttpCode(200)
  async revokeMemberSessions(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertOwner(user);
    if (id === user.id) {
      throw new ConflictException({
        code: 'OWN_SESSIONS',
        message: 'Pour vos propres appareils, utilisez Mon profil.',
      });
    }
    return { revoked: await this.auth.revokeMemberSessions(db, id) };
  }

  /** Everyone must use two-factor sign-in, or not. */
  @Activity('team.two_factor_required', undefined, {
    detail: (req) => String((req.body as { required?: boolean }).required),
  })
  @Put('two-factor')
  requireTwoFactor(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: RequireTwoFactorDto,
  ) {
    return this.twoFactor.setRequired(clinic, user, dto.required);
  }

  @Activity('team.update', 'member')
  @Put(':id')
  update(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.team.update(clinic, user, id, dto);
  }

  /** The invitation again, or a new password link. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Activity('team.link', 'member')
  @Post(':id/link')
  @HttpCode(200)
  issueLink(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.team.issueLink(clinic, user, id);
  }

  @Activity('team.two_factor_reset', 'member')
  @Post(':id/two-factor/reset')
  @HttpCode(200)
  resetTwoFactor(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.team.resetTwoFactor(clinic, user, id);
  }

  @Activity('team.deactivate', 'member')
  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.team.setActive(clinic, user, id, false);
  }

  @Activity('team.reactivate', 'member')
  @Post(':id/reactivate')
  @HttpCode(200)
  reactivate(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.team.setActive(clinic, user, id, true);
  }

  /** A pending invitation only. */
  @Activity('team.delete', 'member')
  @Delete(':id')
  @HttpCode(204)
  remove(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.team.remove(db, user, id);
  }
}
