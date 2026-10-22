import { Pool, neonConfig } from '@neondatabase/serverless';
import {
  Global,
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import type { Env } from '../config/env.js';
import * as schema from './schema/index.js';

// WebSocket driver (not HTTP): needed for interactive transactions.
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
