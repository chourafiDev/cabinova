import { Pool } from '@neondatabase/serverless';
import {
  Global,
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import type { Env } from '../config/env.js';
import { configureNeon } from './neon.js';
import * as schema from './schema/index.js';

configureNeon();

export type Database = NeonDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export const DB_POOL = Symbol('DB_POOL');
export const DB = Symbol('DB');

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(
    @Inject(DB) readonly db: Database,
    @Inject(DB_POOL) private readonly pool: Pool,
  ) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

/**
 * Idle connections are kept a minute (reconnecting costs a handshake), not
 * longer: one dropped while idle (sleep, network change) can look alive,
 * and a query on it waits forever. A query that gets no answer is stopped
 * after 30 s, which also discards its connection; waiting for a free one
 * gives up after 30 s (time for Neon to wake up a suspended database).
 */
const POOL_TIMEOUTS = {
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 30_000,
  query_timeout: 30_000,
};

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new Pool({
          connectionString: config.get('DATABASE_URL'),
          ...POOL_TIMEOUTS,
        }),
    },
    {
      provide: DB,
      inject: [DB_POOL],
      useFactory: (pool: Pool): Database => drizzle({ client: pool, schema }),
    },
    DatabaseService,
  ],
  exports: [DB, DatabaseService],
})
export class DatabaseModule {}
