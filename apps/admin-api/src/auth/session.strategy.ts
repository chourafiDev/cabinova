import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-custom';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';

/** Session cookie → AuthUser (looked up in the current tenant only, via RLS). */
@Injectable()
export class SessionStrategy extends PassportStrategy(Strategy, 'session') {
  constructor(private readonly auth: AuthService) {
    super();
  }

  async validate(req: Request) {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || !token) return null;
    return this.auth.validateSession(token);
  }
}
