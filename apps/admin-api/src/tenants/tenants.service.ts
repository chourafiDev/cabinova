import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
} from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types.js';
import {
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  platformAuditLogs,
  tenantDomains,
  tenants,
} from '../database/schema/index.js';
import type { CreateTenantDto, ListTenantsQuery } from './dto.js';

const like = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`;

const listColumns = {
  id: tenants.id,
  name: tenants.name,
  responsibleName: tenants.responsibleName,
  specialty: tenants.specialty,
  city: tenants.city,
  email: tenants.email,
  status: tenants.status,
  trialEndsAt: tenants.trialEndsAt,
  createdAt: tenants.createdAt,
};

@Injectable()
export class TenantsService {
  constructor(private readonly database: DatabaseService) {}

  list(query: ListTenantsQuery) {
    const term = query.search?.trim();
    const where = and(
      query.status
        ? inArray(
            tenants.status,
            query.status.split(
              ',',
            ) as (typeof tenants.$inferSelect)['status'][],
          )
        : undefined,
      query.city ? eq(tenants.city, query.city) : undefined,
      query.specialty ? eq(tenants.specialty, query.specialty) : undefined,
      term ? this.searchCondition(term) : undefined,
    );
    const [column, direction] = query.sort.split('.') as [
      'name' | 'createdAt',
      'asc' | 'desc',
    ];
    const order = (direction === 'desc' ? desc : asc)(tenants[column]);

    return (async () => {
      const db = this.database.db;
      const [rows, [{ total }]] = await Promise.all([
        db
          .select(listColumns)
          .from(tenants)
          .where(where)
          .orderBy(order, asc(tenants.id))
          .limit(query.perPage)
          .offset((query.page - 1) * query.perPage),
        db.select({ total: count() }).from(tenants).where(where),
      ]);
      return {
        data: rows,
        total,
        pageCount: Math.max(1, Math.ceil(total / query.perPage)),
      };
    })();
  }

  async get(id: string) {
    const db = this.database.db;
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    if (!tenant) throw new NotFoundException('Cabinet introuvable.');
    const [domain] = await db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, id));
    return { ...tenant, domain: domain ?? null };
  }

  create(actor: AuthUser, dto: CreateTenantDto) {
    return this.database.db.transaction(async (tx) => {
      await this.assertUnique(tx, dto);
      const slug = await this.uniqueSlug(tx, dto.name);

      const trialStartsAt = dto.trialStartsAt
        ? new Date(dto.trialStartsAt)
        : new Date();
      const trialDays = dto.trialDays ?? 7;
      const trialEndsAt = new Date(
        trialStartsAt.getTime() + trialDays * 24 * 60 * 60 * 1000,
      );

      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: dto.name,
          legalName: dto.legalName,
          slug,
          specialty: dto.specialty,
          responsibleName: dto.responsibleName,
          address: dto.address,
          city: dto.city,
          phone: dto.phone,
          email: dto.email.toLowerCase(),
          status: 'pending',
          trialStartsAt: trialStartsAt.toISOString().slice(0, 10),
          trialEndsAt: trialEndsAt.toISOString().slice(0, 10),
          maxDoctors: dto.maxDoctors,
          maxUsers: dto.maxUsers,
        })
        .returning();

      const [domain] = await tx
        .insert(tenantDomains)
        .values({ tenantId: tenant.id, subdomain: dto.subdomain })
        .returning();

      await this.audit(tx, actor, {
        action: 'tenant.create',
        entityId: tenant.id,
        metadata: { subdomain: dto.subdomain },
      });

      return { ...tenant, domain };
    });
  }

  private async assertUnique(tx: Transaction, dto: CreateTenantDto) {
    const [byEmail] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.email, dto.email.toLowerCase()));
    if (byEmail) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'Un cabinet utilise déjà cette adresse e-mail.',
      });
    }
    const [byName] = await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(ilike(tenants.name, dto.name));
    if (byName) {
      throw new ConflictException({
        code: 'NAME_TAKEN',
        message: 'Un cabinet porte déjà ce nom.',
      });
    }
    const [byDomain] = await tx
      .select({ tenantId: tenantDomains.tenantId })
      .from(tenantDomains)
      .where(eq(tenantDomains.subdomain, dto.subdomain));
    if (byDomain) {
      throw new ConflictException({
        code: 'SUBDOMAIN_TAKEN',
        message: 'Ce sous-domaine est déjà utilisé.',
      });
    }
  }

  /** Stable technical identifier: slugified name, suffixed if it collides. */
  private async uniqueSlug(tx: Transaction, name: string) {
    const base = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
    let slug = base || 'cabinet';
    for (let n = 2; ; n++) {
      const [taken] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, slug));
      if (!taken) return slug;
      slug = `${base}-${n}`;
    }
  }

  private async audit(
    tx: Transaction,
    actor: AuthUser,
    entry: {
      action: string;
      entityId: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await tx.insert(platformAuditLogs).values({
      userId: actor.id,
      tenantId: entry.entityId,
      entity: 'tenant',
      action: entry.action,
      entityId: entry.entityId,
      metadata: entry.metadata,
    });
  }

  /** Cabinet name, responsible doctor or e-mail. */
  private searchCondition(term: string): SQL | undefined {
    return or(
      ilike(tenants.name, like(term)),
      ilike(tenants.responsibleName, like(term)),
      ilike(tenants.email, like(term)),
    );
  }
}
