import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, ne } from 'drizzle-orm';
import { type AuditActor, diff, writeAudit } from '../audit/audit.js';
import { DatabaseService } from '../database/database.module.js';
import {
  promoCodes,
  promoRedemptions,
  subscriptionPlans,
  subscriptions,
  tenants,
} from '../database/schema/index.js';
import type {
  ApplyPromoCodeDto,
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
} from './dto.js';

/**
 * Codes promo: created once (percentage, number of invoices, end date,
 * uses, plans), applied to a cabinet's live subscription. BillingService
 * applies the discount when invoicing — the better of the code and the
 * commercial discount, never both.
 */
@Injectable()
export class PromoCodesService {
  constructor(private readonly database: DatabaseService) {}

  async list() {
    const db = this.database.db;
    const [codes, uses] = await Promise.all([
      db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt)),
      db
        .select({ id: promoRedemptions.promoCodeId, n: count() })
        .from(promoRedemptions)
        .groupBy(promoRedemptions.promoCodeId),
    ]);
    const now = new Date();
    return codes.map((c) => {
      const redemptions = uses.find((u) => u.id === c.id)?.n ?? 0;
      return {
        ...c,
        redemptions,
        state: !c.active
          ? ('disabled' as const)
          : c.validUntil && c.validUntil < now
            ? ('expired' as const)
            : c.maxRedemptions !== null && redemptions >= c.maxRedemptions
              ? ('exhausted' as const)
              : ('active' as const),
      };
    });
  }

  async create(actor: AuditActor, dto: CreatePromoCodeDto) {
    return this.database.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: promoCodes.id })
        .from(promoCodes)
        .where(eq(promoCodes.code, dto.code));
      if (existing) {
        throw new ConflictException({
          code: 'CODE_TAKEN',
          message: 'Ce code existe déjà.',
        });
      }
      const [created] = await tx
        .insert(promoCodes)
        .values({
          code: dto.code,
          description: dto.description ?? null,
          discountPercent: dto.discountPercent,
          durationInvoices: dto.durationInvoices ?? null,
          planKeys: dto.planKeys ?? [],
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          maxRedemptions: dto.maxRedemptions ?? null,
          createdBy: actor.userId,
        })
        .returning();
      await writeAudit(tx, actor, {
        action: 'billing.promo.create',
        entity: 'promo_code',
        entityId: created.id,
        metadata: {
          code: created.code,
          discountPercent: created.discountPercent,
          durationInvoices: created.durationInvoices,
        },
      });
      return created;
    });
  }

  async update(actor: AuditActor, id: string, dto: UpdatePromoCodeDto) {
    return this.database.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(promoCodes)
        .where(eq(promoCodes.id, id));
      if (!current) throw new NotFoundException('Code introuvable.');
      const next = {
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.description !== undefined && { description: dto.description }),
      };
      const changes = diff(current, next, ['active', 'description']);
      if (!Object.keys(changes).length) return current;
      const [updated] = await tx
        .update(promoCodes)
        .set(next)
        .where(eq(promoCodes.id, id))
        .returning();
      await writeAudit(tx, actor, {
        action: 'billing.promo.update',
        entity: 'promo_code',
        entityId: id,
        metadata: { code: current.code, changes },
      });
      return updated;
    });
  }

  /** Applies a code to the cabinet's live subscription (its next invoices). */
  async apply(actor: AuditActor, tenantId: string, dto: ApplyPromoCodeDto) {
    return this.database.db.transaction(async (tx) => {
      const [sub] = await tx
        .select({ subscription: subscriptions, planKey: subscriptionPlans.key })
        .from(subscriptions)
        .innerJoin(
          subscriptionPlans,
          eq(subscriptionPlans.id, subscriptions.planId),
        )
        .where(
          and(
            eq(subscriptions.tenantId, tenantId),
            ne(subscriptions.status, 'cancelled'),
          ),
        )
        .for('update', { of: subscriptions });
      if (!sub) {
        throw new ConflictException({
          code: 'NO_SUBSCRIPTION',
          message: 'Ce cabinet n’a pas d’abonnement en cours.',
        });
      }
      if (sub.subscription.promoCodeId) {
        throw new ConflictException({
          code: 'PROMO_ALREADY',
          message: 'Un code promo est déjà appliqué : retirez-le d’abord.',
        });
      }
      const [promo] = await tx
        .select()
        .from(promoCodes)
        .where(eq(promoCodes.code, dto.code))
        .for('update');
      const refuse = (message: string) =>
        new BadRequestException({ code: 'PROMO_INVALID', message });
      if (!promo || !promo.active) throw refuse('Code inconnu ou désactivé.');
      if (promo.validUntil && promo.validUntil < new Date()) {
        throw refuse('Ce code a expiré.');
      }
      if (promo.planKeys.length && !promo.planKeys.includes(sub.planKey)) {
        throw refuse('Ce code ne s’applique pas à l’offre de ce cabinet.');
      }
      const [{ n }] = await tx
        .select({ n: count() })
        .from(promoRedemptions)
        .where(eq(promoRedemptions.promoCodeId, promo.id));
      if (promo.maxRedemptions !== null && n >= promo.maxRedemptions) {
        throw refuse('Ce code a atteint son nombre d’utilisations.');
      }
      const [used] = await tx
        .select({ id: promoRedemptions.id })
        .from(promoRedemptions)
        .where(
          and(
            eq(promoRedemptions.promoCodeId, promo.id),
            eq(promoRedemptions.tenantId, tenantId),
          ),
        );
      if (used) throw refuse('Ce cabinet a déjà utilisé ce code.');

      await tx
        .update(subscriptions)
        .set({
          promoCodeId: promo.id,
          promoInvoicesLeft: promo.durationInvoices,
        })
        .where(eq(subscriptions.id, sub.subscription.id));
      await tx.insert(promoRedemptions).values({
        promoCodeId: promo.id,
        tenantId,
        subscriptionId: sub.subscription.id,
        redeemedBy: actor.userId,
      });
      await writeAudit(tx, actor, {
        action: 'billing.promo.apply',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        metadata: {
          code: promo.code,
          discountPercent: promo.discountPercent,
          durationInvoices: promo.durationInvoices,
        },
      });
      return { code: promo.code };
    });
  }

  /** Stops the code for the cabinet's next invoices (the use stays counted). */
  async remove(actor: AuditActor, tenantId: string) {
    return this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ id: subscriptions.id, code: promoCodes.code })
        .from(subscriptions)
        .innerJoin(promoCodes, eq(promoCodes.id, subscriptions.promoCodeId))
        .where(
          and(
            eq(subscriptions.tenantId, tenantId),
            ne(subscriptions.status, 'cancelled'),
          ),
        );
      if (!row) return { ok: true };
      await tx
        .update(subscriptions)
        .set({ promoCodeId: null, promoInvoicesLeft: null })
        .where(eq(subscriptions.id, row.id));
      await writeAudit(tx, actor, {
        action: 'billing.promo.remove',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        metadata: { code: row.code },
      });
      return { ok: true };
    });
  }

  /** For the subscription tab: the code in use and invoices left. */
  async forTenant(tenantId: string) {
    const [row] = await this.database.db
      .select({
        code: promoCodes.code,
        discountPercent: promoCodes.discountPercent,
        invoicesLeft: subscriptions.promoInvoicesLeft,
      })
      .from(subscriptions)
      .innerJoin(promoCodes, eq(promoCodes.id, subscriptions.promoCodeId))
      .innerJoin(tenants, eq(tenants.id, subscriptions.tenantId))
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          ne(subscriptions.status, 'cancelled'),
        ),
      );
    return row ?? null;
  }
}
