import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { TenantLifecycleService } from './tenant-lifecycle.service.js';

const INTERVAL_MS = 60_000;

/**
 * Applies future-dated status changes once their effective date passes.
 * A plain interval is enough at this scale; safe with several instances
 * (applyDue claims rows with SKIP LOCKED). Disabled under tests.
 */
@Injectable()
export class TenantLifecycleScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TenantLifecycleScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly lifecycle: TenantLifecycleService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('NODE_ENV') === 'test') return;
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
    this.timer.unref();
    void this.tick();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.lifecycle.applyDue();
    } catch (err) {
      this.logger.error('Scheduled status changes sweep failed', err);
    } finally {
      this.running = false;
    }
  }
}
