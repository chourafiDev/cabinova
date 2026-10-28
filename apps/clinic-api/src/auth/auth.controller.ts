import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ClinicService } from '../clinic/clinic.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import type { Env } from '../config/env.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { ClinicUser } from './auth.types.js';
import { CurrentUser, Public } from './decorators.js';
import { AcceptInvitationDto, LoginDto } from './dto.js';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Médecin responsable',
  doctor: 'Médecin',
  secretary: 'Secrétaire',
};

@Controller('auth')
export class AuthController {
  private readonly secure: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly clinic: ClinicService,
    private readonly onboarding: OnboardingService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV') === 'production';
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Clinic() { db }: ClinicContext,
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.verifyCredentials(
      db,
      body.email,
      body.password,
    );
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou mot de passe incorrect.',
      });
    }
    await this.signIn(db, user.id, body.rememberMe ?? true, req, res);
    return { ok: true };
  }

  /** Invitation link: who it is for. */
  @Public()
  @Get('invitations/:token')
  async invitation(
    @Clinic() { db }: ClinicContext,
    @Param('token') token: string,
  ) {
    const invitation = await this.auth.findInvitation(db, token);
    if (!invitation) throw this.invalidLink();
    return { name: invitation.name, email: invitation.email };
  }

  /** Chooses the password from the link, then signs in. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('invitations/:token/accept')
  @HttpCode(200)
  async acceptInvitation(
    @Clinic() { db }: ClinicContext,
    @Param('token') token: string,
    @Body() body: AcceptInvitationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.acceptInvitation(db, token, body.password);
    if (!user) throw this.invalidLink();
    await this.signIn(db, user.id, true, req, res);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Clinic() { db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.revokeSession(db, user.sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  /** Current user, cabinet and offer — read by the clinic app on every page. */
  @Get('me')
  async me(
    @Clinic() { tenant, db }: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role] ?? user.role,
      },
      cabinet: {
        name: tenant.name,
        specialty: tenant.specialty,
        city: tenant.city,
        subdomain: tenant.subdomain,
      },
      subscription: await this.clinic.subscription(tenant.id, db),
      onboarding: {
        tourCompleted: await this.onboarding.tourCompleted(db, user.id),
      },
    };
  }

  private async signIn(
    db: ClinicContext['db'],
    userId: string,
    remember: boolean,
    req: Request,
    res: Response,
  ) {
    const { token, expiresAt } = await this.auth.createSession(db, userId, {
      remember,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
      // No expiry = cookie dropped when the browser closes.
      expires: remember ? expiresAt : undefined,
    });
  }

  private invalidLink() {
    return new NotFoundException({
      code: 'INVALID_LINK',
      message:
        'Ce lien est invalide ou a expiré. Demandez-en un nouveau au support Cabinova.',
    });
  }
}
