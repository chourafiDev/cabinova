import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuditActor } from '../audit/audit.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public, RequirePermissions } from '../auth/decorators.js';
import { EmailService } from '../email/email.service.js';
import {
  BrandingSettingsDto,
  EmailSettingsDto,
  GeneralSettingsDto,
  LanguageSettingsDto,
  NotificationSettingsDto,
} from './dto.js';
import { PlatformConfigService } from './platform-config.service.js';

const actorOf = (user: AuthUser, req: Request): AuditActor => ({
  userId: user.id,
  ip: req.ip,
});

/** Configuration globale. Paiements live under /billing/settings. */
@Controller()
export class SettingsController {
  constructor(
    private readonly platform: PlatformConfigService,
    private readonly email: EmailService,
  ) {}

  @RequirePermissions('settings:read')
  @Get('settings')
  async get() {
    return {
      ...(await this.platform.forPage()),
      delivery: this.email.status(),
    };
  }

  @RequirePermissions('settings:write')
  @Put('settings/general')
  general(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: GeneralSettingsDto,
  ) {
    return this.platform.update(actorOf(user, req), 'general', dto);
  }

  @RequirePermissions('settings:write')
  @Put('settings/email')
  emailSettings(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: EmailSettingsDto,
  ) {
    return this.platform.update(actorOf(user, req), 'email', dto);
  }

  @RequirePermissions('settings:write')
  @Put('settings/notifications')
  notifications(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: NotificationSettingsDto,
  ) {
    return this.platform.update(actorOf(user, req), 'notifications', dto);
  }

  @RequirePermissions('settings:write')
  @Put('settings/languages')
  languages(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: LanguageSettingsDto,
  ) {
    return this.platform.update(actorOf(user, req), 'languages', dto);
  }

  @RequirePermissions('settings:write')
  @Put('settings/branding')
  branding(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body() dto: BrandingSettingsDto,
  ) {
    return this.platform.update(actorOf(user, req), 'branding', dto);
  }

  /** Sends a test e-mail to the signed-in admin. */
  @RequirePermissions('settings:write')
  @Post('settings/email/test')
  async testEmail(@CurrentUser() user: AuthUser) {
    const { delivered } = await this.email.sendTest(user.email);
    return { to: user.email, delivered };
  }

  /** Public: the sign-in page shows the platform's name and logo. */
  @Public()
  @Get('branding')
  publicBranding() {
    return this.platform.branding();
  }

  @Public()
  @Get('branding/logo')
  @Header('Cache-Control', 'public, max-age=86400')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'")
  async logo(@Res({ passthrough: true }) res: Response) {
    const logo = await this.platform.logo();
    if (!logo) throw new NotFoundException();
    res.setHeader('Content-Type', logo.contentType);
    return new StreamableFile(logo.data);
  }
}
