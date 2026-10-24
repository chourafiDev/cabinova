import {
  BadRequestException,
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
  ne,
  or,
  type SQL,
} from 'drizzle-orm';
import { diff } from '../audit/audit.js';
import {
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  platformAuditLogs,
  platformUsers,
  subscriptionPlans,
  subscriptions,
  tenantDomains,
  tenants,
  tenantStatusChanges,
} from '../database/schema/index.js';
import type {
  CreateTenantDto,
  ListTenantAuditQuery,
  ListTenantsQuery,
  UpdateTenantDto,
} from './dto.js';
import { availableTransitions, isEditable } from './lifecycle.js';
import { type AuditActor, auditTenant } from './tenant-audit.js';

/** Columns an admin may edit (Scenario B), in audit order. */
const EDITABLE = [
  'name',
  'legalName',
  'responsibleName',
  'specialty',
  'address',
  'city',
  'phone',
  'email',
  'maxDoctors',
  'maxSecretaries',
  'maxUsers',
  'storageQuotaMb',
] as const satisfies readonly (keyof UpdateTenantDto)[];

/** ILIKE pattern with wildcards escaped; `contains` wraps it in %…%. */
const like = (term: string, contains = true) => {
  const escaped = term.replace(/[\\%_]/g, '\\$&');
  return contains ? `%${escaped}%` : escaped;
};

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
  plan: { key: subscriptionPlans.key, name: subscriptionPlans.name },
};

/** The cabinet's live (non-cancelled) subscription; at most one exists. */
const liveSubscription = and(
  eq(subscriptions.tenantId, tenants.id),
  ne(subscriptions.status, 'cancelled'),
);

const DAY_MS = 24 * 60 * 60 * 1000;

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
      query.plan
        ? inArray(subscriptionPlans.key, query.plan.split(','))
        : undefined,
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
          .leftJoin(subscriptions, liveSubscription)
          .leftJoin(
            subscriptionPlans,
            eq(subscriptionPlans.id, subscriptions.planId),
          )
          .where(where)
          .orderBy(order, asc(tenants.id))
          .limit(query.perPage)
          .offset((query.page - 1) * query.perPage),
        db
          .select({ total: count() })
          .from(tenants)
          .leftJoin(subscriptions, liveSubscription)
          .leftJoin(
            subscriptionPlans,
            eq(subscriptionPlans.id, subscriptions.planId),
          )
          .where(where),
      ]);
      return {
        // Cabinets created before Module 3 have no plan.
        data: rows.map((row) => ({
          ...row,
          plan: row.plan?.key ? row.plan : null,
        })),
        total,
        pageCount: Math.max(1, Math.ceil(total / query.perPage)),
      };
    })();
  }

  async get(id: string) {
    const db = this.database.db;
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    if (!tenant) throw new NotFoundException('Cabinet introuvable.');
    const [[domain], [scheduledStatusChange], [subscription]] =
      await Promise.all([
        db.select().from(tenantDomains).where(eq(tenantDomains.tenantId, id)),
        db
          .select()
          .from(tenantStatusChanges)
          .where(
            and(
              eq(tenantStatusChanges.tenantId, id),
              eq(tenantStatusChanges.state, 'scheduled'),
            ),
          ),
        db
          .select({
            id: subscriptions.id,
            billingPeriod: subscriptions.billingPeriod,
            price: subscriptions.price,
            status: subscriptions.status,
            startedAt: subscriptions.startedAt,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            plan: {
              id: subscriptionPlans.id,
              key: subscriptionPlans.key,
              name: subscriptionPlans.name,
              features: subscriptionPlans.features,
            },
          })
          .from(subscriptions)
          .innerJoin(
            subscriptionPlans,
            eq(subscriptionPlans.id, subscriptions.planId),
          )
          .where(
            and(
              eq(subscriptions.tenantId, id),
              ne(subscriptions.status, 'cancelled'),
            ),
          ),
      ]);
    return {
      ...tenant,
      domain: domain ?? null,
      subscription: subscription ?? null,
      editable: isEditable(tenant.status),
      // Nothing else can be requested while a change is scheduled.
      availableTransitions: scheduledStatusChange
        ? []
        : availableTransitions(tenant.status),
      scheduledStatusChange: scheduledStatusChange ?? null,
    };
  }

  /** Scenario B: only fields that actually change are written and audited. */
  update(id: string, actor: AuditActor, dto: UpdateTenantDto) {
    return this.database.db.transaction(async (tx) => {
      const [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, id))
        .for('update');
      if (!tenant) throw new NotFoundException('Cabinet introuvable.');
      if (!isEditable(tenant.status)) {
        throw new ConflictException({
          code: 'TENANT_CLOSED',
          message: 'Un cabinet fermé ne peut plus être modifié.',
        });
      }

      if (dto.email) dto.email = dto.email.toLowerCase();
      const changes = diff(tenant, dto, EDITABLE);
      if (!Object.keys(changes).length) return tenant;

      await this.assertUnique(
        tx,
        {
          name: changes.name ? dto.name : undefined,
          email: changes.email ? dto.email : undefined,
        },
        id,
      );

      const [updated] = await tx
        .update(tenants)
        .set(
          Object.fromEntries(
            Object.entries(changes).map(([key, { to }]) => [key, to]),
          ),
        )
        .where(eq(tenants.id, id))
        .returning();

      await auditTenant(tx, actor, {
        action: 'tenant.update',
        tenantId: id,
        metadata: { changes },
      });
      return updated;
    });
  }

  /** Scenario B, Audit tab: administrative changes on one cabinet. */
  async listAudit(id: string, query: ListTenantAuditQuery) {
    const db = this.database.db;
    const where = eq(platformAuditLogs.tenantId, id);
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: platformAuditLogs.id,
          action: platformAuditLogs.action,
          metadata: platformAuditLogs.metadata,
          ip: platformAuditLogs.ip,
          createdAt: platformAuditLogs.createdAt,
          actor: { id: platformUsers.id, name: platformUsers.name },
        })
        .from(platformAuditLogs)
        .leftJoin(platformUsers, eq(platformUsers.id, platformAuditLogs.userId))
        .where(where)
        .orderBy(desc(platformAuditLogs.createdAt), desc(platformAuditLogs.id))
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
      db.select({ total: count() }).from(platformAuditLogs).where(where),
    ]);
    return {
      data: rows.map((row) => ({
        ...row,
        actor: row.actor?.id ? row.actor : null,
      })),
      total,
      pageCount: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  create(actor: AuditActor, dto: CreateTenantDto) {
    return this.database.db.transaction(async (tx) => {
      await this.assertUnique(tx, dto);
      const [plan] = await tx
        .select()
        .from(subscriptionPlans)
        .where(
          and(
            eq(subscriptionPlans.key, dto.planKey),
            eq(subscriptionPlans.active, true),
          ),
        );
      if (!plan) {
        throw new BadRequestException({
          code: 'PLAN_UNAVAILABLE',
          message: "Cette offre n'existe pas ou n'est plus proposée.",
        });
      }
      const slug = await this.uniqueSlug(tx, dto.name);

      const trialStartsAt = dto.trialStartsAt
        ? new Date(dto.trialStartsAt)
        : new Date();
      const trialDays = dto.trialDays ?? plan.trialDays;
      const trialEndsAt = new Date(
        trialStartsAt.getTime() + trialDays * DAY_MS,
      );
      // The plan's limits, unless this cabinet overrides them.
      const quota = <
        K extends
          'maxDoctors' | 'maxSecretaries' | 'maxUsers' | 'storageQuotaMb',
      >(
        key: K,
      ) => (dto[key] !== undefined ? dto[key] : plan[key]);

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
          maxDoctors: quota('maxDoctors'),
          maxSecretaries: quota('maxSecretaries'),
          maxUsers: quota('maxUsers'),
          storageQuotaMb: quota('storageQuotaMb'),
        })
        .returning();

      // Trial first; billing (Module 3, payments) takes over at its end.
      const [subscription] = await tx
        .insert(subscriptions)
        .values({
          tenantId: tenant.id,
          planId: plan.id,
          billingPeriod: dto.billingPeriod,
          price:
            dto.billingPeriod === 'annual'
              ? plan.priceAnnual
              : plan.priceMonthly,
          status: 'trialing',
          startedAt: trialStartsAt,
          currentPeriodEnd: trialEndsAt,
        })
        .returning();

      const [domain] = await tx
        .insert(tenantDomains)
        .values({ tenantId: tenant.id, subdomain: dto.subdomain })
        .returning();

      await auditTenant(tx, actor, {
        action: 'tenant.create',
        tenantId: tenant.id,
        metadata: {
          subdomain: dto.subdomain,
          plan: plan.key,
          billingPeriod: dto.billingPeriod,
          trialDays,
        },
      });

      return { ...tenant, domain, subscription };
    });
  }

  /** Uniqueness rules of Scenario A; `exceptId` skips the cabinet being edited. */
  private async assertUnique(
    tx: Transaction,
    dto: { name?: string; email?: string; subdomain?: string },
    exceptId?: string,
  ) {
    const notSelf = exceptId ? ne(tenants.id, exceptId) : undefined;
    const [byEmail] = dto.email
      ? await tx
          .select({ id: tenants.id })
          .from(tenants)
          .where(and(eq(tenants.email, dto.email.toLowerCase()), notSelf))
      : [];
    if (byEmail) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'Un cabinet utilise déjà cette adresse e-mail.',
      });
    }
    const [byName] = dto.name
      ? await tx
          .select({ id: tenants.id })
          .from(tenants)
          .where(and(ilike(tenants.name, like(dto.name, false)), notSelf))
      : [];
    if (byName) {
      throw new ConflictException({
        code: 'NAME_TAKEN',
        message: 'Un cabinet porte déjà ce nom.',
      });
    }
    const [byDomain] = dto.subdomain
      ? await tx
          .select({ tenantId: tenantDomains.tenantId })
          .from(tenantDomains)
          .where(eq(tenantDomains.subdomain, dto.subdomain))
      : [];
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

  /** Cabinet name, responsible doctor or e-mail. */
  private searchCondition(term: string): SQL | undefined {
    return or(
      ilike(tenants.name, like(term)),
      ilike(tenants.responsibleName, like(term)),
      ilike(tenants.email, like(term)),
    );
  }
}
