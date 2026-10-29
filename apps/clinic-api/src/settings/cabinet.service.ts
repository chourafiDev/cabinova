import type { Pool } from '@neondatabase/serverless';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { CatalogService } from '../database/catalog.module.js';
import { TenancyService } from '../tenancy/tenancy.service.js';
import type { UpdateCabinetDto } from './dto.js';

type Identity = {
  name: string;
  legalName: string | null;
  specialty: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string;
};

/** Editable identity fields: API key → column (catalog `tenants` and clinic `clinic_settings`). */
const FIELDS = [
  ['name', 'name'],
  ['legalName', 'legal_name'],
  ['specialty', 'specialty'],
  ['address', 'address'],
  ['city', 'city'],
  ['phone', 'phone'],
  ['email', 'email'],
] as const satisfies readonly (readonly [keyof Identity, string])[];

const SELECT = FIELDS.map(([key, column]) => `${column} as "${key}"`).join(
  ', ',
);

/**
 * The cabinet's identity. Its source of truth is the catalog (`tenants`),
 * which Super Admin edits too: a change here is written there, with the same
 * uniqueness rules and the same audit entry ("tenant.update", marked as made
 * by the cabinet), then copied to the clinic's own `clinic_settings`.
 *
 * Production: the catalog role of clinic-api needs UPDATE on those columns of
 * `tenants` (plus updated_at) and INSERT on `platform_audit_logs`.
 */
@Injectable()
export class CabinetService {
  private readonly logger = new Logger(CabinetService.name);

  constructor(
    private readonly catalog: CatalogService,
    private readonly tenancy: TenancyService,
  ) {}

  async get(tenantId: string) {
    const { rows } = await this.catalog.pool.query<
      Identity & { subdomain: string }
    >(
      `select ${SELECT},
              (select subdomain from tenant_domains d where d.tenant_id = t.id
                order by d.created_at limit 1) as subdomain
         from tenants t where id = $1`,
      [tenantId],
    );
    if (!rows[0]) throw new NotFoundException('Cabinet introuvable.');
    return rows[0];
  }

  async update(
    tenantId: string,
    db: Pool,
    user: ClinicUser,
    dto: UpdateCabinetDto,
    ip: string | undefined,
  ) {
    const client = await this.catalog.pool.connect();
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    try {
      await client.query('begin');
      const { rows } = await client.query<Identity>(
        `select ${SELECT} from tenants where id = $1 for update`,
        [tenantId],
      );
      const current = rows[0];
      if (!current) throw new NotFoundException('Cabinet introuvable.');

      for (const [key] of FIELDS) {
        const to = dto[key] ?? null;
        if (to !== current[key]) changes[key] = { from: current[key], to };
      }
      if (!Object.keys(changes).length) {
        await client.query('commit');
        return this.get(tenantId);
      }

      await this.assertUnique(client, tenantId, changes);
      const set = FIELDS.filter(([key]) => changes[key]);
      await client.query(
        `update tenants set ${set.map(([, column], i) => `${column} = $${i + 2}`).join(', ')},
                updated_at = now()
          where id = $1`,
        [tenantId, ...set.map(([key]) => dto[key] ?? null)],
      );
      // Same entry as a Super Admin edit; no platform user, the clinic user
      // is in the metadata.
      await client.query(
        `insert into platform_audit_logs
           (user_id, tenant_id, entity, entity_id, action, metadata, ip)
         values (null, $1, 'tenant', $1, 'tenant.update', $2, $3)`,
        [
          tenantId,
          JSON.stringify({
            changes,
            source: 'clinic',
            by: { id: user.id, name: user.name, email: user.email },
          }),
          ip ?? null,
        ],
      );
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }

    this.tenancy.forget(tenantId);
    await this.mirror(db, dto);
    return this.get(tenantId);
  }

  /** The clinic database's copy; the catalog stays authoritative if it fails. */
  private async mirror(db: Pool, dto: UpdateCabinetDto) {
    try {
      await db.query(
        `update clinic_settings set ${FIELDS.map(([, column], i) => `${column} = $${i + 1}`).join(', ')},
                updated_at = now()
          where id = 1`,
        FIELDS.map(([key]) => dto[key] ?? null),
      );
    } catch (err) {
      this.logger.warn(`clinic_settings not updated: ${String(err)}`);
    }
  }

  /** As in admin-api: one cabinet per e-mail and per name (case-insensitive). */
  private async assertUnique(
    client: { query: Pool['query'] },
    tenantId: string,
    changes: Record<string, unknown>,
  ) {
    const taken = async (where: string, value: unknown) =>
      (
        await client.query(
          `select 1 from tenants where ${where} and id <> $2 limit 1`,
          [value, tenantId],
        )
      ).rowCount;
    if (
      changes.email &&
      (await taken('email = $1', (changes.email as { to: unknown }).to))
    ) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'Un cabinet utilise déjà cette adresse e-mail.',
      });
    }
    if (
      changes.name &&
      (await taken(
        'lower(name) = lower($1)',
        (changes.name as { to: unknown }).to,
      ))
    ) {
      throw new ConflictException({
        code: 'NAME_TAKEN',
        message: 'Un cabinet porte déjà ce nom.',
      });
    }
  }
}
