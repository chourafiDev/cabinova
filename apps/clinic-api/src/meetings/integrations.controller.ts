import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Activity } from '../activity/activity.decorator.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { Clinic } from '../tenancy/decorators.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { GoogleConnectionService } from './google-connection.service.js';

/** Paramètres › Intégrations: the Google account behind team meetings. */
@Controller('integrations/google')
export class IntegrationsController {
  constructor(private readonly google: GoogleConnectionService) {}

  @Get()
  status(@Clinic() clinic: ClinicContext) {
    return this.google.status(clinic);
  }

  /** Where to send the owner's browser: Google's consent screen. */
  @Post('connect')
  @HttpCode(200)
  connect(@Clinic() clinic: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.google.connectUrl(clinic, user);
  }

  @Activity('integrations.google_disconnect')
  @Delete()
  @HttpCode(204)
  disconnect(@Clinic() clinic: ClinicContext, @CurrentUser() user: ClinicUser) {
    return this.google.disconnect(clinic, user);
  }

  /**
   * Google sends the browser here, on one address for every cabinet: no
   * tenancy from the host (see AppModule), the signed state names the
   * cabinet. Back to the clinic app with the outcome.
   */
  @Public()
  @Get('callback')
  async callback(
    @Query() query: { code?: string; state?: string; error?: string },
    @Res() res: Response,
  ) {
    const back = await this.google.callback(query);
    if (back) return res.redirect(302, back);
    res
      .status(400)
      .type('text/plain; charset=utf-8')
      .send(
        'Ce lien de connexion Google a expiré. Recommencez depuis Cabinova (Paramètres › Intégrations).',
      );
  }
}
