import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { SecretBox } from '../tenant-databases/secret-box.js';

export const SECRET_BOX = Symbol('SECRET_BOX');

/**
 * The master key (TENANT_SECRETS_KEY), shared by everything that encrypts
 * at rest: clinic database credentials and platform users' 2FA secrets.
 * null when the key isn't configured — those features then refuse to run.
 */
@Global()
@Module({
  providers: [
    {
      provide: SECRET_BOX,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const key = config.get('TENANT_SECRETS_KEY', { infer: true });
        return key
          ? SecretBox.fromEnv(
              key,
              config.get('TENANT_SECRETS_KEY_VERSION'),
              config.get('TENANT_SECRETS_PREVIOUS_KEYS', { infer: true }),
            )
          : null;
      },
    },
  ],
  exports: [SECRET_BOX],
})
export class CryptoModule {}
