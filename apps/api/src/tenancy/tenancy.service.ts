import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { Env } from '../config/env.js';
import { DatabaseService } from '../database/database.module.js';
import { tenants } from '../database/schema/index.js';
import type { Tenant } from './tenant-context.js';

const CACHE_TTL = 60_000;

@Injectable()
export class TenancyService {
  private readonly rootDomain: string;
  private readonly cache = new Map<
    string,
    { tenant: Tenant | null; at: number }
  >();

  constructor(
    private readonly database: DatabaseService,
    config: ConfigService<Env, true>,
  ) {
    this.rootDomain = config.get('ROOT_DOMAIN').toLowerCase();
  }

  /**
   * "clinique-x.cabinova.ma" → tenant "clinique-x"; any other host is looked
   * up as a custom domain. Cached briefly: the catalog is read on every request.
   */
  async resolveHost(hostname: string): Promise<Tenant | null> {
    const host = hostname.toLowerCase();
    const hit = this.cache.get(host);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.tenant;

    const tenant = await this.lookup(host);
    this.cache.set(host, { tenant, at: Date.now() });
    return tenant;
  }

  private async lookup(host: string) {
    const suffix = `.${this.rootDomain}`;
    let where;
    if (host.endsWith(suffix)) {
      const slug = host.slice(0, -suffix.length);
      if (!slug || slug.includes('.')) return null;
      where = eq(tenants.slug, slug);
    } else if (host === this.rootDomain) {
      return null;
    } else {
      where = eq(tenants.customDomain, host);
    }
    const [tenant] = await this.database.db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        locale: tenants.locale,
        timezone: tenants.timezone,
      })
      .from(tenants)
      .where(where)
      .limit(1);
    return tenant ?? null;
  }
}
