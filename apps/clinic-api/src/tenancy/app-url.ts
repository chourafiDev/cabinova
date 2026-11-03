import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/** The clinic app of a cabinet ("https://gueliz.cabinova.ma"), for links and redirects. */
export function clinicAppUrl(config: ConfigService<Env, true>) {
  const template =
    config.get('CLINIC_APP_URL', { infer: true }) ??
    (config.get('NODE_ENV') === 'production'
      ? `https://{subdomain}.${config.get('TENANT_BASE_DOMAIN')}`
      : 'http://{subdomain}.localhost:3002');
  return (subdomain: string) => template.replace('{subdomain}', subdomain);
}
