import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service.js';
import { PlatformConfigService } from './platform-config.service.js';

export type TeamAlertKind =
  'incidents' | 'databaseUnreachable' | 'invoiceOverdue';

/**
 * E-mails the team (Configuration → Notifications) when something needs a
 * human now. Never throws: an alert must not break what triggered it.
 */
@Injectable()
export class TeamAlertsService {
  private readonly logger = new Logger(TeamAlertsService.name);

  constructor(
    private readonly platform: PlatformConfigService,
    private readonly email: EmailService,
  ) {}

  async send(
    kind: TeamAlertKind,
    alert: { subject: string; lines: string[]; path: string },
  ) {
    try {
      const { team } = await this.platform.get('notifications');
      if (!team[kind] || !team.recipients.length) return;
      await this.email.sendTeamAlert({ to: team.recipients, ...alert });
    } catch (err) {
      this.logger.error(`Team alert "${kind}" failed`, err);
    }
  }
}
