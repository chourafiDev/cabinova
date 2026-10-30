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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
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
  ) {}

  @Get()
  list(@Clinic() clinic: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.team.list(clinic, user);
  }

  /** Sends the invitation e-mail; the link is also returned to copy. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  invite(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.team.invite(clinic, user, dto);
  }

  /** Everyone must use two-factor sign-in, or not. */
  @Put('two-factor')
  requireTwoFactor(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() dto: RequireTwoFactorDto,
  ) {
    return this.twoFactor.setRequired(clinic, user, dto.required);
  }

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
  @Post(':id/link')
  @HttpCode(200)
  issueLink(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.team.issueLink(clinic, user, id);
  }

  @Post(':id/two-factor/reset')
  @HttpCode(200)
  resetTwoFactor(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.team.resetTwoFactor(clinic, user, id);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.team.setActive(clinic, user, id, false);
  }

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
