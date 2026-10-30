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
import { NotificationsService } from '../notifications/notifications.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { SpacesService } from '../spaces/spaces.service.js';
import type { Env } from '../config/env.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { ClinicUser } from './auth.types.js';
import { AllowBeforeTwoFactor, CurrentUser, Public } from './decorators.js';
import {
  AcceptInvitationDto,
  ForgotPasswordDto,
  LoginDto,
  TwoFactorChallengeDto,
  TwoFactorCodeDto,
} from './dto.js';
import { ROLE_LABELS } from './roles.js';
import { TwoFactorService } from './two-factor.service.js';
import { TeamService } from '../team/team.service.js';

@AllowBeforeTwoFactor()
@Controller('auth')
export class AuthController {
  private readonly secure: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly clinic: ClinicService,
    private readonly onboarding: OnboardingService,
    private readonly spaces: SpacesService,
    private readonly notifications: NotificationsService,
    private readonly twoFactor: TwoFactorService,
    private readonly team: TeamService,
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
    // 2FA accounts get a short-lived challenge, not a session: the code comes next.
    if (user.twoFactor) {
      const challenge = await this.twoFactor.createChallenge(
        db,
        user.id,
        body.rememberMe ?? true,
      );
      return { twoFactorRequired: true, challenge };
    }
    await this.signIn(db, user.id, body.rememberMe ?? true, req, res);
    return { ok: true };
  }

  /** Second step of the sign-in; each code counts against the challenge. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify')
  @HttpCode(200)
  async verifyTwoFactor(
    @Clinic() clinic: ClinicContext,
    @Body() body: TwoFactorChallengeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, remember } = await this.twoFactor.completeChallenge(
      clinic,
      body.challenge,
      body.code,
    );
    await this.signIn(clinic.db, userId, remember, req, res);
    return { ok: true };
  }

  @Get('2fa')
  twoFactorStatus(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    return this.twoFactor.status(clinic, user.id);
  }

  /** Enrolment: a new secret to scan, active only after /2fa/enable. */
  @Post('2fa/setup')
  @HttpCode(200)
  setupTwoFactor(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
  ) {
    return this.twoFactor.setup(clinic, user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/enable')
  @HttpCode(200)
  enableTwoFactor(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() body: TwoFactorCodeDto,
  ) {
    return this.twoFactor.enable(clinic, user.id, body.code);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/disable')
  @HttpCode(200)
  disableTwoFactor(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() body: TwoFactorCodeDto,
  ) {
    return this.twoFactor.disable(clinic, user.id, body.code);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/recovery-codes')
  @HttpCode(200)
  regenerateRecoveryCodes(
    @Clinic() clinic: ClinicContext,
    @CurrentUser() user: ClinicUser,
    @Body() body: TwoFactorCodeDto,
  ) {
    return this.twoFactor.regenerateRecoveryCodes(clinic, user.id, body.code);
  }

  /**
   * Sends a reset link if the account exists. Same answer and same timing
   * either way (the e-mail isn't awaited), so nobody can test addresses.
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(
    @Clinic() clinic: ClinicContext,
    @Body() body: ForgotPasswordDto,
  ) {
    void this.team.sendPasswordReset(clinic, body.email);
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
    return {
      name: invitation.name,
      email: invitation.email,
      reset: invitation.hasPassword,
    };
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
    if (user.joined) await this.notifications.memberJoined(db, user.id);
    // A password link must not skip the second factor.
    if (await this.twoFactor.isEnabled(db, user.id)) {
      return { ok: true, loginRequired: true };
    }
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
        twoFactorSetupRequired: user.twoFactorSetupRequired,
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
      spaces: await this.spaces.current(db, user).catch(() => null),
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
        'Ce lien est invalide ou a expiré. Demandez-en un nouveau au médecin responsable du cabinet, ou au support Cabinova.',
    });
  }
}
