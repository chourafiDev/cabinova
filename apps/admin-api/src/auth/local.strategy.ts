import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-local';
import { AuthService } from './auth.service.js';

/** POST /auth/login body: e-mail + password. Failed attempts are audited. */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email', passReqToCallback: true });
  }

  async validate(req: Request, email: string, password: string) {
    const user = await this.auth.verifyCredentials(email, password);
    if (!user) {
      await this.auth.auditFailedLogin(email, req.ip);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou mot de passe incorrect.',
      });
    }
    return user;
  }
}
