import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, ne } from 'drizzle-orm';
import { type AuditActor, diff, writeAudit } from '../audit/audit.js';
import {
  type Database,
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  features,
  subscriptionPlans,
  subscriptions,
} from '../database/schema/index.js';
import { FEATURE_LEVELS, type PlanFeatures } from './catalog.js';
import type { CreatePlanDto, ListPlansQuery, UpdatePlanDto } from './dto.js';

/** Plan columns an admin may edit, in audit order. The key never changes. */
const EDITABLE = [
  'name',
  'description',
  'priceMonthly',
  'priceAnnual',
  'trialDays',
  'maxDoctors',
  'maxSecretaries',
  'maxUsers',
  'storageQuotaMb',
  'features',
  'sortOrder',
  'active',
] as const;

/** Module 3 — the plans catalog (Starter, Pro, Enterprise…). */
@Injectable()
export class PlansService {
  constructor(private readonly database: DatabaseService) {}

  /** Plans in display order, each with its number of live subscriptions. */
  list(query: ListPlansQuery) {
    return this.database.db
      .select({ plan: subscriptionPlans, tenantCount: count(subscriptions.id) })
      .from(subscriptionPlans)
      .leftJoin(
        subscriptions,
        and(
          eq(subscriptions.planId, subscriptionPlans.id),
          ne(subscriptions.status, 'cancelled'),
        ),
      )
      .where(
        query.active
          ? eq(subscriptionPlans.active, query.active === 'true')
          : undefined,
      )
      .groupBy(subscriptionPlans.id)
      .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.name))
      .then((rows) =>
        rows.map(({ plan, tenantCount }) => ({ ...plan, tenantCount })),
      );
  }

  async get(id: string) {
    const [plan] = await this.database.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id));
    if (!plan) throw new NotFoundException('Offre introuvable.');
    return plan;
  }

  create(actor: AuditActor, dto: CreatePlanDto) {
    return this.database.db.transaction(async (tx) => {
      const [taken] = await tx
        .select({ id: subscriptionPlans.id })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.key, dto.key));
      if (taken) {
        throw new ConflictException({
          code: 'PLAN_KEY_TAKEN',
          message: 'Une offre utilise déjà cet identifiant.',
        });
      }
      const [plan] = await tx.insert(subscriptionPlans).values(dto).returning();
      await writeAudit(tx, actor, {
        action: 'plan.create',
        entity: 'plan',
        entityId: plan.id,
        metadata: { key: plan.key },
      });
      return plan;
    });
  }

  /**
   * Price, trial and limit changes apply to cabinets created afterwards:
   * existing cabinets keep the quotas copied at their creation.
   */
  update(id: string, actor: AuditActor, dto: UpdatePlanDto) {
    return this.database.db.transaction(async (tx) => {
      const [plan] = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, id))
        .for('update');
      if (!plan) throw new NotFoundException('Offre introuvable.');

      dto.features = await this.checkFeatures(tx, dto.features);
      const changes = diff(plan, dto, EDITABLE);
      if (!Object.keys(changes).length) return plan;

      const [updated] = await tx
        .update(subscriptionPlans)
        .set(
          Object.fromEntries(
            Object.entries(changes).map(([key, { to }]) => [key, to]),
          ),
        )
        .where(eq(subscriptionPlans.id, id))
        .returning();
      await writeAudit(tx, actor, {
        action: 'plan.update',
        entity: 'plan',
        entityId: id,
        metadata: { key: plan.key, changes },
      });
      return updated;
    });
  }

  /** Keeps only catalog features with a valid level; refuses unknown ones. */
  private async checkFeatures(
    tx: Database | Transaction,
    levels: PlanFeatures,
  ): Promise<PlanFeatures> {
    const known = new Set(
      (await tx.select({ key: features.key }).from(features)).map((f) => f.key),
    );
    for (const [key, level] of Object.entries(levels ?? {})) {
      if (!known.has(key) || !FEATURE_LEVELS.includes(level)) {
        throw new BadRequestException({
          code: 'INVALID_FEATURE',
          message: `Fonctionnalité ou niveau invalide : ${key}.`,
        });
      }
    }
    return { ...levels };
  }
}
