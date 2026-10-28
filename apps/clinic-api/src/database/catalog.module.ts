import { Pool } from '@neondatabase/serverless';
import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretBox } from '@cabinova/secret-box';
import type { Env } from '../config/env.js';
import { configureNeon } from './neon.js';

configureNeon();

export const CATALOG = Symbol('CATALOG');
export const SECRET_BOX = Symbol('SECRET_BOX');

/**
 * The platform catalog, read-only from here: which cabinet a subdomain is,
 * its status and offer, and the (encrypted) credentials of its database.
 */
@Injectable()
export class CatalogService implements OnApplicationShutdown {
  constructor(@Inject(CATALOG) readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: CATALOG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new Pool({ connectionString: config.get('DATABASE_URL'), max: 5 }),
    },
    {
      provide: SECRET_BOX,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        SecretBox.fromEnv(
          config.get('TENANT_SECRETS_KEY'),
          config.get('TENANT_SECRETS_KEY_VERSION'),
          config.get('TENANT_SECRETS_PREVIOUS_KEYS', { infer: true }),
        ),
    },
    CatalogService,
  ],
  exports: [CatalogService, SECRET_BOX],
})
export class CatalogModule {}
