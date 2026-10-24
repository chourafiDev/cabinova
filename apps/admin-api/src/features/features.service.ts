import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ne } from 'drizzle-orm';
import { type AuditActor, diff, writeAudit } from '../audit/audit.js';
import { DatabaseService } from '../database/database.module.js';
import {
  features,
  subscriptionPlans,
  subscriptions,
  tenantFeatureOverrides,
  tenants,
} from '../database/schema/index.js';
import type { FeatureLevel, PlanFeatures } from '../plans/catalog.js';
import type {
  CreateFeatureDto,
  SetOverrideDto,
  UpdateFeatureDto,
} from './dto.js';
import { isOverrideActive, resolveFeature } from './resolve.js';

const EDITABLE = [
  'name',
  'description',
  'category',
  'sortOrder',
  'status',
  'disabledReason',
] as const;

/**
 * "Fonctionnalités et options": the feature catalog (create, beta, global
 * switch-off), per-cabinet exceptions with optional dates, and what each
 * cabinet effectively gets (resolve.ts). "Usage" figures are reach — how
 * many cabinets can use a feature now; actual usage needs the clinic app.
 */
@Injectable()
export class FeaturesService {
  constructor(private readonly database: DatabaseService) {}

  /** The catalog with each plan's level and the number of cabinets reached. */
  async list() {
    const now = new Date();
    const [catalog, plans, cabinets, overrides] = await Promise.all([
      this.catalog(),
      this.database.db
        .select({
          key: subscriptionPlans.key,
          name: subscriptionPlans.name,
          features: subscriptionPlans.features,
        })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.active, true))
        .orderBy(asc(subscriptionPlans.sortOrder)),
      this.cabinets(),
      this.database.db.select().from(tenantFeatureOverrides),
    ]);
    return catalog.map((feature) => {
      const mine = overrides.filter((o) => o.featureKey === feature.key);
      const reached = cabinets.filter((c) => {
        const o = mine.find((x) => x.tenantId === c.id);
        return resolveFeature({
          status: feature.status,
          planLevel: c.planFeatures
            ? (c.planFeatures[feature.key] ?? 'none')
            : null,
          override: o ?? null,
          now,
        }).enabled;
      }).length;
      return {
        ...feature,
        plans: plans.map((p) => ({
          key: p.key,
          name: p.name,
          level: (p.features as PlanFeatures)[feature.key] ?? 'none',
        })),
        cabinetsReached: reached,
        cabinetsTotal: cabinets.length,
        overrides: mine.length,
        activeOverrides: mine.filter((o) => isOverrideActive(o, now)).length,
      };
    });
  }

  /** One feature with its exceptions (testers for a beta). */
  async get(key: string) {
    const feature = await this.find(key);
    const overrides = await this.database.db
      .select({
        id: tenantFeatureOverrides.id,
        tenantId: tenantFeatureOverrides.tenantId,
        tenantName: tenants.name,
        tenantStatus: tenants.status,
        level: tenantFeatureOverrides.level,
        startsAt: tenantFeatureOverrides.startsAt,
        endsAt: tenantFeatureOverrides.endsAt,
        note: tenantFeatureOverrides.note,
        updatedAt: tenantFeatureOverrides.updatedAt,
      })
      .from(tenantFeatureOverrides)
      .innerJoin(tenants, eq(tenants.id, tenantFeatureOverrides.tenantId))
      .where(eq(tenantFeatureOverrides.featureKey, key))
      .orderBy(asc(tenants.name));
    const now = new Date();
    return {
      ...feature,
      overrides: overrides.map((o) => ({
        ...o,
        active: isOverrideActive(o, now),
      })),
    };
  }

  create(actor: AuditActor, dto: CreateFeatureDto) {
    return this.database.db.transaction(async (tx) => {
      const [taken] = await tx
        .select({ key: features.key })
        .from(features)
        .where(eq(features.key, dto.key));
      if (taken) {
        throw new ConflictException({
          code: 'FEATURE_KEY_TAKEN',
          message: 'Une fonctionnalité utilise déjà cet identifiant.',
        });
      }
      const [feature] = await tx
        .insert(features)
        .values({
          key: dto.key,
          name: dto.name,
          description: dto.description ?? null,
          category: dto.category ?? null,
          sortOrder: dto.sortOrder ?? 0,
          status: dto.status,
          disabledReason:
            dto.status === 'disabled' ? (dto.disabledReason ?? null) : null,
        })
        .returning();
      await this.audit(tx, actor, 'feature.create', dto.key, {
        status: dto.status,
      });
      return feature;
    });
  }

  /** Edits, puts in beta, or switches off (kill switch) — always audited. */
  update(actor: AuditActor, key: string, dto: UpdateFeatureDto) {
    return this.database.db.transaction(async (tx) => {
      const [feature] = await tx
        .select()
        .from(features)
        .where(eq(features.key, key))
        .for('update');
      if (!feature) throw new NotFoundException('Fonctionnalité introuvable.');
      const next = {
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category ?? null,
        sortOrder: dto.sortOrder ?? feature.sortOrder,
        status: dto.status,
        disabledReason:
          dto.status === 'disabled' ? (dto.disabledReason ?? null) : null,
      };
      const changes = diff(feature, next, EDITABLE);
      if (!Object.keys(changes).length) return feature;
      const [updated] = await tx
        .update(features)
        .set(next)
        .where(eq(features.key, key))
        .returning();
      await this.audit(
        tx,
        actor,
        changes.status ? `feature.status.${dto.status}` : 'feature.update',
        key,
        { changes },
      );
      return updated;
    });
  }

  /** Every feature for one cabinet: plan level, exception, and the result. */
  async forTenant(tenantId: string) {
    const now = new Date();
    const [cabinet] = await this.cabinets(tenantId);
    if (!cabinet) throw new NotFoundException('Cabinet introuvable.');
    const [catalog, overrides] = await Promise.all([
      this.catalog(),
      this.database.db
        .select()
        .from(tenantFeatureOverrides)
        .where(eq(tenantFeatureOverrides.tenantId, tenantId)),
    ]);
    return {
      plan: cabinet.planName,
      features: catalog.map((feature) => {
        const override =
          overrides.find((o) => o.featureKey === feature.key) ?? null;
        const planLevel = cabinet.planFeatures
          ? (cabinet.planFeatures[feature.key] ?? 'none')
          : null;
        return {
          key: feature.key,
          name: feature.name,
          category: feature.category,
          status: feature.status,
          disabledReason: feature.disabledReason,
          planLevel,
          override: override && {
            id: override.id,
            level: override.level,
            startsAt: override.startsAt,
            endsAt: override.endsAt,
            note: override.note,
            active: isOverrideActive(override, now),
          },
          effective: resolveFeature({
            status: feature.status,
            planLevel,
            override,
            now,
          }),
        };
      }),
    };
  }

  /** Creates or replaces a cabinet's exception for one feature. */
  setOverride(
    actor: AuditActor,
    tenantId: string,
    key: string,
    dto: SetOverrideDto,
  ) {
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'La date de fin doit suivre la date de début.',
      });
    }
    return this.database.db.transaction(async (tx) => {
      await this.find(key, tx);
      const [tenant] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      if (!tenant) throw new NotFoundException('Cabinet introuvable.');
      const values = {
        level: dto.level,
        startsAt,
        endsAt,
        note: dto.note ?? null,
        createdBy: actor.userId,
      };
      const [row] = await tx
        .insert(tenantFeatureOverrides)
        .values({ tenantId, featureKey: key, ...values })
        .onConflictDoUpdate({
          target: [
            tenantFeatureOverrides.tenantId,
            tenantFeatureOverrides.featureKey,
          ],
          set: values,
        })
        .returning();
      await writeAudit(tx, actor, {
        action: 'tenant.feature.override',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        metadata: {
          feature: key,
          level: dto.level,
          startsAt: dto.startsAt ?? null,
          endsAt: dto.endsAt ?? null,
          note: dto.note ?? null,
        },
      });
      return row;
    });
  }

  removeOverride(actor: AuditActor, tenantId: string, key: string) {
    return this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .delete(tenantFeatureOverrides)
        .where(
          and(
            eq(tenantFeatureOverrides.tenantId, tenantId),
            eq(tenantFeatureOverrides.featureKey, key),
          ),
        )
        .returning();
      if (!row)
        throw new NotFoundException(
          'Aucune exception pour cette fonctionnalité.',
        );
      await writeAudit(tx, actor, {
        action: 'tenant.feature.override_removed',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        metadata: { feature: key, level: row.level },
      });
    });
  }

  private catalog() {
    return this.database.db
      .select()
      .from(features)
      .orderBy(asc(features.sortOrder), asc(features.name));
  }

  /** Cabinets (not closed) with their live plan's feature levels. */
  private cabinets(tenantId?: string) {
    return this.database.db
      .select({
        id: tenants.id,
        planName: subscriptionPlans.name,
        planFeatures: subscriptionPlans.features,
      })
      .from(tenants)
      .leftJoin(
        subscriptions,
        and(
          eq(subscriptions.tenantId, tenants.id),
          ne(subscriptions.status, 'cancelled'),
        ),
      )
      .leftJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, subscriptions.planId),
      )
      .where(tenantId ? eq(tenants.id, tenantId) : ne(tenants.status, 'closed'))
      .then((rows) =>
        rows.map((r) => ({
          ...r,
          planFeatures: r.planFeatures as Record<string, FeatureLevel> | null,
        })),
      );
  }

  private async find(key: string, tx = this.database.db) {
    const [feature] = await tx
      .select()
      .from(features)
      .where(eq(features.key, key));
    if (!feature) throw new NotFoundException('Fonctionnalité introuvable.');
    return feature;
  }

  private audit(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    actor: AuditActor,
    action: string,
    key: string,
    metadata: Record<string, unknown>,
  ) {
    return writeAudit(tx, actor, {
      action,
      entity: 'feature',
      // Features are keyed by text; the audit entity id column is a uuid.
      entityId: '00000000-0000-0000-0000-000000000000',
      metadata: { feature: key, ...metadata },
    });
  }
}
