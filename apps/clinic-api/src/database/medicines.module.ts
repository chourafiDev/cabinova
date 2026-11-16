import { type PoolClient, Pool } from '@neondatabase/serverless';
import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { configureNeon } from './neon.js';
import { POOL } from './pool.js';

configureNeon();

const MEDICINES_POOL = Symbol('MEDICINES_POOL');

/**
 * The shared medicines database (the national AMMPS list), read only from
 * here: admin-api alone writes it. Null when MEDICINES_DATABASE_URL isn't
 * set — ordonnances then fall back to the doctor's own medicines.
 */
@Injectable()
export class MedicinesDb implements OnApplicationShutdown {
  constructor(@Inject(MEDICINES_POOL) readonly pool: Pool | null) {}

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
        if (!url) return null;
        const pool = new Pool({ connectionString: url, ...POOL, max: 5 });
        // Whatever the role allows, a clinic never writes here.
        pool.on('connect', (client: PoolClient) => {
          void client.query('set default_transaction_read_only = on');
        });
        return pool;
      },
    },
    MedicinesDb,
  ],
  exports: [MedicinesDb],
})
export class MedicinesDbModule {}
