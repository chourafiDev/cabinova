import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { BillingService } from './billing.service.js';

const INTERVAL_MS = 60 * 60_000;

/**
 * Hourly billing sweep (trial ends, renewals, overdue). Idempotent and safe
 * with several instances (rows claimed with SKIP LOCKED). Disabled in tests.
 */
@Injectable()
export class BillingScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BillingScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('NODE_ENV') === 'test') return;
    const run = () =>
      this.billing
        .sweep()
        .catch((err) => this.logger.error('Billing sweep failed', err));
    this.timer = setInterval(run, INTERVAL_MS);
    this.timer.unref();
    void run();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }
}
