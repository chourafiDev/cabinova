import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { ProvisioningService } from './provisioning.service.js';
import { TenantDatabasesService } from './tenant-databases.service.js';

const RECOVERY_INTERVAL_MS = 60_000;
const HEALTH_INTERVAL_MS = 10 * 60_000;

/**
 * Background upkeep: fails provisioning runs interrupted by a restart, and
 * tests every clinic database's connection (an unreachable one is audited
 * and flagged on the Technique page). Disabled under tests.
 */
@Injectable()
export class TenantDatabasesScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TenantDatabasesScheduler.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private checking = false;

  constructor(
    private readonly provisioning: ProvisioningService,
    private readonly databases: TenantDatabasesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('NODE_ENV') === 'test') return;
    this.every(RECOVERY_INTERVAL_MS, () => this.provisioning.recoverStale());
    this.every(HEALTH_INTERVAL_MS, async () => {
      if (this.checking) return;
      this.checking = true;
      try {
        await this.databases.checkAll();
      } finally {
        this.checking = false;
      }
    });
  }

  onApplicationShutdown() {
    this.timers.forEach(clearInterval);
  }

  private every(ms: number, task: () => Promise<unknown>) {
    const run = () =>
      task().catch((err) => this.logger.error('Scheduled task failed', err));
    const timer = setInterval(run, ms);
    timer.unref();
    this.timers.push(timer);
  }
}
