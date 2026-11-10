import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { SupportService } from './support.service.js';

// Often enough for the 1–2 h first-answer deadlines.
const INTERVAL_MS = 5 * 60_000;

/**
 * Support sweep every 5 minutes: overdue-ticket notifications, and resolved
 * tickets closing after 7 quiet days. Idempotent
 * and safe with several instances. Disabled in tests.
 */
@Injectable()
export class SupportScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SupportScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly support: SupportService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('NODE_ENV') === 'test') return;
    const run = () =>
      this.support
        .sweep()
        .catch((err) => this.logger.error('Support sweep failed', err));
    this.timer = setInterval(run, INTERVAL_MS);
    this.timer.unref();
    void run();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }
}
