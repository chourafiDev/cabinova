import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, lte, ne } from 'drizzle-orm';
import {
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  subscriptions,
  tenants,
  tenantStatusChanges,
} from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import type { ChangeTenantStatusDto } from './dto.js';
import {
  canTransition,
  isValidReason,
  TENANT_TRANSITIONS,
  type TenantTransition,
} from './lifecycle.js';
import { type AuditActor, auditTenant } from './tenant-audit.js';

type StatusChange = typeof tenantStatusChanges.$inferSelect;
type Tenant = typeof tenants.$inferSelect;

/** Words used in the e-mail to the responsible doctor. */
const OUTCOME: Partial<Record<TenantTransition, string>> = {
  suspend: 'suspendu',
  reactivate: 'réactivé',
  start_closure: 'mis en période de fermeture',
  close: 'fermé',
};

/** Furthest a change can be scheduled ahead. */
const MAX_SCHEDULE_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * The only writer of `tenants.status`. Each change is checked against the
 * transition table (lifecycle.ts), recorded in tenant_status_changes with
 * its motive and effective date, and audited. Future-dated changes are
 * applied by `applyDue()`, called from TenantLifecycleScheduler.
 */
@Injectable()
export class TenantLifecycleService {
  private readonly logger = new Logger(TenantLifecycleService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly email: EmailService,
  ) {}

  async request(
    tenantId: string,
    actor: AuditActor,
    dto: ChangeTenantStatusDto,
  ) {
    if (!isValidReason(dto.action, dto.reason)) {
      throw new BadRequestException({
        code: 'INVALID_REASON',
        message: 'Motif invalide pour cette action.',
      });
    }
    const now = new Date();
    const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : now;
    if (effectiveAt.getTime() - now.getTime() > MAX_SCHEDULE_MS) {
      throw new BadRequestException({
        code: 'EFFECTIVE_DATE_TOO_FAR',
        message: "La date d'effet ne peut pas dépasser un an.",
      });
    }
    const scheduled = effectiveAt > now;

    const { tenant, change } = await this.database.db.transaction(
      async (tx) => {
        const tenant = await this.lockTenant(tx, tenantId);
        const [pending] = await tx
          .select({ id: tenantStatusChanges.id })
          .from(tenantStatusChanges)
          .where(
            and(
              eq(tenantStatusChanges.tenantId, tenantId),
              eq(tenantStatusChanges.state, 'scheduled'),
            ),
          );
        if (pending) {
          throw new ConflictException({
            code: 'STATUS_CHANGE_PENDING',
            message:
              'Un changement de statut est déjà programmé. Annulez-le avant d’en demander un autre.',
          });
        }
        if (!canTransition(tenant.status, dto.action)) {
          throw new ConflictException({
            code: 'INVALID_TRANSITION',
            message: `Action impossible depuis le statut « ${tenant.status} ».`,
          });
        }

        const [change] = await tx
          .insert(tenantStatusChanges)
          .values({
            tenantId,
            action: dto.action,
            fromStatus: tenant.status,
            toStatus: TENANT_TRANSITIONS[dto.action].to,
            reason: dto.reason,
            comment: dto.comment,
            effectiveAt: scheduled ? effectiveAt : now,
            state: scheduled ? 'scheduled' : 'applied',
            appliedAt: scheduled ? null : now,
            notifyResponsible: dto.notifyResponsible,
            requestedBy: actor.userId,
          })
          .returning();

        if (scheduled) {
          await auditTenant(tx, actor, {
            action: 'tenant.status.schedule',
            tenantId,
            metadata: this.auditMetadata(change),
          });
        } else {
          await this.writeStatus(tx, actor, change);
        }
        return { tenant, change };
      },
    );

    if (change.notifyResponsible) await this.notify(tenant, change);
    return change;
  }

  /**
   * Platform-driven transitions (provision, activate, provision_failed),
   * inside the caller's transaction. Same rules and records as a manual
   * change, applied immediately and without a motive.
   */
  async applySystem(
    tx: Transaction,
    tenantId: string,
    action: Extract<
      TenantTransition,
      'provision' | 'activate' | 'provision_failed' | 'suspend' | 'reactivate'
    >,
    actor: AuditActor,
    comment: string,
    /** Billing: suspend for 'unpaid', reactivate on 'payment_regularized'. */
    reason?: string,
  ) {
    const tenant = await this.lockTenant(tx, tenantId);
    if (!canTransition(tenant.status, action)) {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: `Action impossible depuis le statut « ${tenant.status} ».`,
      });
    }
    const now = new Date();
    const [change] = await tx
      .insert(tenantStatusChanges)
      .values({
        tenantId,
        action,
        fromStatus: tenant.status,
        toStatus: TENANT_TRANSITIONS[action].to,
        reason: reason ?? null,
        comment,
        effectiveAt: now,
        state: 'applied',
        appliedAt: now,
        notifyResponsible: false,
        requestedBy: actor.userId,
      })
      .returning();
    await this.writeStatus(tx, actor, change, { system: true });
    return tenant;
  }

  async cancel(tenantId: string, changeId: string, actor: AuditActor) {
    return this.database.db.transaction(async (tx) => {
      const [change] = await tx
        .update(tenantStatusChanges)
        .set({ state: 'cancelled' })
        .where(
          and(
            eq(tenantStatusChanges.id, changeId),
            eq(tenantStatusChanges.tenantId, tenantId),
            eq(tenantStatusChanges.state, 'scheduled'),
          ),
        )
        .returning();
      if (!change) {
        throw new NotFoundException('Aucun changement programmé à annuler.');
      }
      await auditTenant(tx, actor, {
        action: 'tenant.status.cancel',
        tenantId,
        metadata: this.auditMetadata(change),
      });
      return change;
    });
  }

  /**
   * Applies every scheduled change whose effective date has passed. Rows are
   * claimed with SKIP LOCKED, so several API instances can run it at once.
   * A change whose starting status no longer holds is marked failed.
   */
  async applyDue(limit = 50) {
    let applied = 0;
    for (let i = 0; i < limit; i++) {
      const result = await this.database.db.transaction(async (tx) => {
        const [change] = await tx
          .select()
          .from(tenantStatusChanges)
          .where(
            and(
              eq(tenantStatusChanges.state, 'scheduled'),
              lte(tenantStatusChanges.effectiveAt, new Date()),
            ),
          )
          .orderBy(asc(tenantStatusChanges.effectiveAt))
          .limit(1)
          .for('update', { skipLocked: true });
        if (!change) return null;

        const tenant = await this.lockTenant(tx, change.tenantId);
        // Applied on the platform's behalf, attributed to the requester.
        const actor: AuditActor = { userId: change.requestedBy };
        if (
          tenant.status !== change.fromStatus ||
          !canTransition(tenant.status, change.action as TenantTransition)
        ) {
          const failureReason = `Statut actuel « ${tenant.status} » au lieu de « ${change.fromStatus} ».`;
          await tx
            .update(tenantStatusChanges)
            .set({ state: 'failed', failureReason })
            .where(eq(tenantStatusChanges.id, change.id));
          await auditTenant(tx, actor, {
            action: 'tenant.status.failed',
            tenantId: tenant.id,
            metadata: { ...this.auditMetadata(change), failureReason },
          });
          return { tenant, change: null };
        }

        const [updated] = await tx
          .update(tenantStatusChanges)
          .set({ state: 'applied', appliedAt: new Date() })
          .where(eq(tenantStatusChanges.id, change.id))
          .returning();
        await this.writeStatus(tx, actor, updated, { automatic: true });
        return { tenant, change: updated };
      });

      if (!result) break;
      if (result.change) {
        applied++;
        if (result.change.notifyResponsible) {
          await this.notify(result.tenant, result.change);
        }
      }
    }
    if (applied)
      this.logger.log(`Applied ${applied} scheduled status change(s)`);
    return applied;
  }

  private async writeStatus(
    tx: Transaction,
    actor: AuditActor,
    change: StatusChange,
    extra: Record<string, unknown> = {},
  ) {
    await tx
      .update(tenants)
      .set({ status: change.toStatus })
      .where(eq(tenants.id, change.tenantId));
    // A closed cabinet's subscription ends with it (counted as a
    // cancellation on the dashboard).
    if (change.toStatus === 'closed') {
      await tx
        .update(subscriptions)
        .set({
          status: 'cancelled',
          cancelledAt: change.appliedAt ?? new Date(),
        })
        .where(
          and(
            eq(subscriptions.tenantId, change.tenantId),
            ne(subscriptions.status, 'cancelled'),
          ),
        );
    }
    await auditTenant(tx, actor, {
      action: 'tenant.status.apply',
      tenantId: change.tenantId,
      metadata: { ...this.auditMetadata(change), ...extra },
    });
  }

  private async lockTenant(tx: Transaction, id: string): Promise<Tenant> {
    const [tenant] = await tx
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .for('update');
    if (!tenant) throw new NotFoundException('Cabinet introuvable.');
    return tenant;
  }

  private auditMetadata(change: StatusChange) {
    return {
      changeId: change.id,
      transition: change.action,
      from: change.fromStatus,
      to: change.toStatus,
      reason: change.reason,
      comment: change.comment,
      effectiveAt: change.effectiveAt.toISOString(),
    };
  }

  /** Never blocks the status change: EmailService logs its own failures. */
  private async notify(tenant: Tenant, change: StatusChange) {
    const outcome = OUTCOME[change.action as TenantTransition];
    if (!outcome || !change.comment) return;
    try {
      await this.email.sendTenantStatusNotice({
        email: tenant.email,
        name: tenant.responsibleName,
        tenantName: tenant.name,
        outcome,
        effectiveOn:
          change.state === 'scheduled'
            ? new Intl.DateTimeFormat('fr-MA', {
                dateStyle: 'long',
                timeZone: tenant.timezone,
              }).format(change.effectiveAt)
            : undefined,
        comment: change.comment,
      });
    } catch (err) {
      this.logger.error(`Status notice for ${tenant.id} failed`, err);
    }
  }
}
