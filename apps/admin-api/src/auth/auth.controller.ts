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
import { AcceptInvitationDto, LoginDto } from './dto.js';
import { LocalAuthGuard } from './guards.js';

@Controller('auth')
export class AuthController {
  private readonly secure: boolean;

  constructor(
    private readonly auth: AuthService,
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
    const { id } = req.user as { id: string };
    await this.signIn(id, body.rememberMe ?? true, req, res);
    return { ok: true };
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
  ) {
    const { token, expiresAt } = await this.auth.createSession(userId, {
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
      message: 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.',
    });
  }

  /** Current platform user, read by admin-web on every page. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return {
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
