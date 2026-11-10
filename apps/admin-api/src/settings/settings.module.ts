import { Global, Module } from '@nestjs/common';
import { PlatformConfigService } from './platform-config.service.js';
import { SettingsController } from './settings.controller.js';
import { TeamAlertsService } from './team-alerts.service.js';

/** Global: e-mails, billing, support and tenants all read the configuration. */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [PlatformConfigService, TeamAlertsService],
  exports: [PlatformConfigService, TeamAlertsService],
})
export class SettingsModule {}
