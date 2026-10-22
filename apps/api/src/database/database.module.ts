import { Pool, neonConfig } from '@neondatabase/serverless';
import {
  Global,
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import type { Env } from '../config/env.js';
import { currentTenant } from '../tenancy/tenant-context.js';
import * as schema from './schema/index.js';

// WebSocket driver (not HTTP): needed for interactive transactions,
// which carry the per-request `app.tenant_id` used by RLS.
neonConfig.webSocketConstructor = ws;

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

  /**
   * Runs `fn` in a transaction scoped to one tenant: RLS policies read
   * `current_setting('app.tenant_id')`, so every query inside only sees
   * (and can only write) that tenant's rows.
   */
  withTenant<T>(tenantId: string, fn: (tx: Transaction) => Promise<T>) {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.tenant_id', ${tenantId}, true)`,
      );
      return fn(tx);
    });
  }

  /** withTenant() for the tenant of the current request. */
  tenant<T>(fn: (tx: Transaction) => Promise<T>) {
    return this.withTenant(currentTenant().id, fn);
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new Pool({ connectionString: config.get('DATABASE_URL') }),
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
