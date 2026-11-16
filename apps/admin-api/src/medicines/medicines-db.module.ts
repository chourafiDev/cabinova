import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Pool } from '@neondatabase/serverless';
import * as schema from '@cabinova/medicines-db/schema';
import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import type { Env } from '../config/env.js';
import { configureNeon } from '../database/neon.js';

configureNeon();

export type MedicinesDatabase = NeonDatabase<typeof schema>;

/** Migrations of @cabinova/medicines-db, the shared AMMPS medicines list. */
export const MEDICINES_MIGRATIONS = join(
  dirname(
    createRequire(import.meta.url).resolve(
      '@cabinova/medicines-db/package.json',
    ),
  ),
  'migrations',
);

const MEDICINES_POOL = Symbol('MEDICINES_POOL');

/**
 * The shared medicines database (MEDICINES_DATABASE_URL), which only
 * admin-api writes. Optional: without the variable the API runs, and the
 * medicines pages say the database isn't configured. Brought to the latest
 * schema at startup, like the clinic databases.
 */
@Injectable()
export class MedicinesDbService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MedicinesDbService.name);
  private readonly database: MedicinesDatabase | null;

  constructor(@Inject(MEDICINES_POOL) private readonly pool: Pool | null) {
    this.database = pool ? drizzle({ client: pool, schema }) : null;
  }

  get configured() {
    return this.database !== null;
  }

  /** The database, or 503 when MEDICINES_DATABASE_URL isn't set. */
  get db(): MedicinesDatabase {
    if (!this.database) {
      throw new ServiceUnavailableException(
        'Base des médicaments non configurée (MEDICINES_DATABASE_URL).',
      );
    }
    return this.database;
  }

  async onApplicationBootstrap() {
    if (!this.database) {
      this.logger.warn('MEDICINES_DATABASE_URL not set: medicines disabled');
      return;
    }
    try {
      await migrate(this.database, { migrationsFolder: MEDICINES_MIGRATIONS });
    } catch (err) {
      // The rest of the platform keeps running; imports will fail loudly.
      // Drizzle wraps the driver's error: its cause says what really failed.
      const cause = (err as { cause?: unknown }).cause;
      const why = cause instanceof Error ? ` — ${cause.message}` : '';
      this.logger.error(
        `Medicines database migration failed: ${String(err)}${why}`,
      );
    }
  }

  async onApplicationShutdown() {
    await this.pool?.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: MEDICINES_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const url = config.get('MEDICINES_DATABASE_URL', { infer: true });
        return url
          ? new Pool({
              connectionString: url,
              idleTimeoutMillis: 60_000,
              connectionTimeoutMillis: 30_000,
              query_timeout: 30_000,
              max: 3,
            })
          : null;
      },
    },
    MedicinesDbService,
  ],
  exports: [MedicinesDbService],
})
export class MedicinesDbModule {}
