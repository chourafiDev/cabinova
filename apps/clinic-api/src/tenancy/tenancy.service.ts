import { Pool } from '@neondatabase/serverless';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SecretBox } from '@cabinova/secret-box';
import type { Env } from '../config/env.js';
import { CatalogService, SECRET_BOX } from '../database/catalog.module.js';
import { subdomainOf } from './host.js';
import { isBehind } from './schema-version.js';

export type ClinicTenant = {
  id: string;
  name: string;
  specialty: string | null;
  city: string | null;
  subdomain: string;
  status: string;
};

type Row = ClinicTenant & {
  host: string | null;
  database_name: string | null;
  role_name: string | null;
  ciphertext: string | null;
  key_version: number | null;
  schema_version: string | null;
};

/** The cabinet this request is for, and a pool on its own database. */
export type ClinicContext = { tenant: ClinicTenant; db: Pool };

// Status changes in the admin (suspension…) reach the clinic within this delay.
const CACHE_MS = 30_000;

@Injectable()
export class TenancyService implements OnApplicationShutdown {
  private readonly baseDomains: string[];
  private readonly hosts = new Map<string, { row: Row | null; at: number }>();
  /** One small pool per cabinet, replaced when its credentials change. */
  private readonly pools = new Map<string, { secret: string; pool: Pool }>();

  constructor(
    private readonly catalog: CatalogService,
    @Inject(SECRET_BOX) private readonly secrets: SecretBox,
    config: ConfigService<Env, true>,
  ) {
    this.baseDomains = [config.get('TENANT_BASE_DOMAIN')];
    if (config.get('NODE_ENV') !== 'production')
      this.baseDomains.push('localhost');
  }

  /**
   * The cabinet for a request host, or an error the clinic app shows as is:
   * unknown, not ready yet (not provisioned), suspended or closed.
   */
  async resolve(host: string): Promise<ClinicContext> {
    const subdomain = subdomainOf(host, this.baseDomains);
    const row = subdomain ? await this.lookup(subdomain) : null;
    if (!row || row.status === 'closed') {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Aucun cabinet à cette adresse.',
      });
    }
    if (row.status === 'suspended' || row.status === 'closure_pending') {
      throw new ForbiddenException({
        code: 'TENANT_SUSPENDED',
        message:
          'L’accès à ce cabinet est suspendu. Contactez le support Cabinova.',
      });
    }
    if (row.status !== 'active' || !row.ciphertext) {
      throw new NotFoundException({
        code: 'TENANT_NOT_READY',
        message: 'Ce cabinet est en cours de préparation.',
      });
    }
    // Deploys migrate every cabinet (admin-api, at startup); until this one
    // is done, its database lacks what this code uses.
    if (isBehind(row.schema_version)) {
      throw new ServiceUnavailableException({
        code: 'TENANT_OUTDATED',
        message:
          'Votre espace est en cours de mise à jour. Réessayez dans quelques instants.',
      });
    }
    const { id, name, specialty, city, status } = row;
    return {
      tenant: { id, name, specialty, city, status, subdomain: row.subdomain },
      db: this.poolFor(row),
    };
  }

  /** The cabinet's identity changed: the next request reads it again. */
  forget(tenantId: string) {
    for (const [subdomain, { row }] of this.hosts) {
      if (row?.id === tenantId) this.hosts.delete(subdomain);
    }
  }

  async onApplicationShutdown() {
    await Promise.all([...this.pools.values()].map(({ pool }) => pool.end()));
  }

  private async lookup(subdomain: string) {
    const hit = this.hosts.get(subdomain);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.row;
    const { rows } = await this.catalog.pool.query<Row>(
      `select t.id, t.name, t.specialty, t.city, t.status, d.subdomain,
              db.host, db.database_name, db.role_name, db.schema_version,
              s.ciphertext, s.key_version
         from tenant_domains d
         join tenants t on t.id = d.tenant_id
         left join tenant_databases db on db.tenant_id = t.id
         left join tenant_secrets s on s.id = db.secret_ref
        where d.subdomain = $1`,
      [subdomain],
    );
    const row = rows[0] ?? null;
    this.hosts.set(subdomain, { row, at: Date.now() });
    return row;
  }

  private poolFor(row: Row) {
    const cached = this.pools.get(row.id);
    if (cached?.secret === row.ciphertext) return cached.pool;
    if (cached) void cached.pool.end();

    // Same connection string as admin-api's TenantConnections.
    const password = this.secrets.decrypt(
      row.ciphertext!,
      row.key_version!,
      row.id,
    );
    const url = new URL(`postgresql://${row.host}/${row.database_name}`);
    url.username = row.role_name!;
    url.password = password;
    url.searchParams.set('sslmode', 'require');
    const pool = new Pool({ connectionString: url.toString(), max: 3 });
    this.pools.set(row.id, { secret: row.ciphertext!, pool });
    return pool;
  }
}
