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
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Env } from '../config/env.js';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { CurrentUser, Public } from './decorators.js';
import {
  AcceptInvitationDto,
  LoginDto,
  TwoFactorChallengeDto,
  TwoFactorCodeDto,
} from './dto.js';
import { LocalAuthGuard } from './guards.js';
import { TwoFactorService } from './two-factor.service.js';

@Controller('auth')
export class AuthController {
  private readonly secure: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly twoFactor: TwoFactorService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV') === 'production';
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { id, twoFactor } = req.user as { id: string; twoFactor: boolean };
    // 2FA accounts get a short-lived challenge, not a session: the code comes next.
    if (twoFactor) {
      const challenge = await this.twoFactor.createChallenge(
        id,
        body.rememberMe ?? true,
      );
      return { twoFactorRequired: true, challenge };
    }
    await this.signIn(id, body.rememberMe ?? true, req, res);
    return { ok: true };
  }

  /** Second sign-in step: the authenticator code (or a backup code). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify')
  @HttpCode(200)
  async verifyTwoFactor(
    @Body() body: TwoFactorChallengeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.twoFactor.completeChallenge(
      body.challenge,
      body.code,
      req.ip,
    );
    await this.signIn(result.userId, result.remember, req, res, result.method);
    return { ok: true };
  }

  @Get('2fa')
  twoFactorStatus(@CurrentUser() user: AuthUser) {
    return this.twoFactor.statusFor(user.id);
  }

  /** Enrolment: a new secret to scan, active only after /2fa/enable. */
  @Post('2fa/setup')
  @HttpCode(200)
  setupTwoFactor(@CurrentUser() user: AuthUser) {
    return this.twoFactor.setup(user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/enable')
  @HttpCode(200)
  enableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() body: TwoFactorCodeDto,
  ) {
    return this.twoFactor.enable({ userId: user.id, ip: req.ip }, body.code);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/disable')
  @HttpCode(200)
  disableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() body: TwoFactorCodeDto,
  ) {
    return this.twoFactor.disable({ userId: user.id, ip: req.ip }, body.code);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/recovery-codes')
  @HttpCode(200)
  regenerateRecoveryCodes(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() body: TwoFactorCodeDto,
  ) {
    return this.twoFactor.regenerateRecoveryCodes(
      { userId: user.id, ip: req.ip },
      body.code,
    );
  }

  /** Invitation or password-reset link: who it is for. */
  @Public()
  @Get('invitations/:token')
  async invitation(@Param('token') token: string) {
    const invitation = await this.auth.findInvitation(token);
    if (!invitation) throw this.invalidLink();
    const { name, email, isReset } = invitation;
    return { name, email, isReset };
  }

  /** Chooses the password from the link, then signs in. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('invitations/:token/accept')
  @HttpCode(200)
  async acceptInvitation(
    @Param('token') token: string,
    @Body() body: AcceptInvitationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.acceptInvitation(token, body.password);
    if (!user) throw this.invalidLink();
    await this.signIn(user.id, true, req, res);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.revokeSession(user.sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  private async signIn(
    userId: string,
    remember: boolean,
    req: Request,
    res: Response,
    method: 'password' | 'totp' | 'recovery' = 'password',
  ) {
    const { token, expiresAt } = await this.auth.createSession(userId, {
      remember,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      method,
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
      message: 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.',
    });
  }

  /** Current platform user, read by admin-web on every page. */
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return {
      twoFactor: await this.twoFactor.statusFor(user.id),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        permissions: user.permissions,
      },
    };
  }
}
