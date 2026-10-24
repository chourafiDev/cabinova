import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  sum,
} from 'drizzle-orm';
import { DatabaseService } from '../database/database.module.js';
import {
  invoices,
  subscriptionPlans,
  subscriptions,
  tenantDatabases,
  tenantProvisioningRuns,
  tenants,
  tenantStatusChanges,
} from '../database/schema/index.js';
import { latestSchemaVersion } from '../tenant-databases/tenant-connections.js';
import type { DashboardQuery } from './dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** French labels of tenant statuses, for alerts and the CSV export. */
export const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  provisioning: 'Provisionnement',
  active: 'Actif',
  suspended: 'Suspendu',
  closure_pending: 'Fermeture en cours',
  closed: 'Fermé',
};
const MONTHS = 12;
const TOP = 8;

type TenantStatus = (typeof tenants.$inferSelect)['status'];

export type AlertItem = { tenantId: string; name: string; detail?: string };
export type Alert = {
  key: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  count: number;
  items: AlertItem[];
  href: string;
};

/** The cabinet's live subscription (at most one, see subscriptions_one_live_idx). */
const liveSubscription = and(
  eq(subscriptions.tenantId, tenants.id),
  ne(subscriptions.status, 'cancelled'),
);

/** Monthly-equivalent price (centimes): annual subscriptions count 1/12. */
const monthlyPrice = sql<number>`case when ${subscriptions.billingPeriod} = 'annual' then ${subscriptions.price} / 12.0 else ${subscriptions.price} end`;

const monthOf = (column: Parameters<typeof sql>[1]) =>
  sql<string>`to_char(date_trunc('month', ${column}), 'YYYY-MM')`;

/**
 * Module 1 — consolidated platform figures. Never patient data: everything
 * here comes from the catalog (cabinets, subscriptions, invoices, technical
 * state). Billed, collected and unpaid amounts are kept separate on purpose.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  async overview(query: DashboardQuery) {
    const scope = this.scope(query);
    const [kpis, series, breakdowns, alerts, filters] = await Promise.all([
      this.kpis(scope),
      this.series(scope),
      this.breakdowns(scope),
      this.alerts(),
      this.filterOptions(),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      kpis,
      series,
      breakdowns,
      alerts,
      filters,
    };
  }

  /** Ids of the cabinets the filters select, as a subquery. */
  private scope(q: DashboardQuery) {
    const plans = q.plan?.split(',') ?? [];
    const keys = plans.filter((p) => p !== 'none');
    return this.database.db
      .select({ id: tenants.id })
      .from(tenants)
      .leftJoin(subscriptions, liveSubscription)
      .leftJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, subscriptions.planId),
      )
      .where(
        and(
          q.from ? gte(tenants.createdAt, new Date(q.from)) : undefined,
          q.to
            ? lt(tenants.createdAt, new Date(Date.parse(q.to) + DAY_MS))
            : undefined,
          q.status
            ? inArray(tenants.status, q.status.split(',') as TenantStatus[])
            : undefined,
          q.city ? eq(tenants.city, q.city) : undefined,
          q.specialty ? eq(tenants.specialty, q.specialty) : undefined,
          plans.length
            ? or(
                keys.length ? inArray(subscriptionPlans.key, keys) : undefined,
                plans.includes('none') ? isNull(subscriptions.id) : undefined,
              )
            : undefined,
        ),
      );
  }

  private async kpis(scope: ReturnType<DashboardService['scope']>) {
    const db = this.database.db;
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * DAY_MS);
    const d60 = new Date(now.getTime() - 60 * DAY_MS);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const inScope = inArray(tenants.id, scope);

    const [
      statusRows,
      [recent],
      [previous],
      subscriptionRows,
      trialsEnding,
      billing,
    ] = await Promise.all([
      db
        .select({ status: tenants.status, n: count() })
        .from(tenants)
        .where(inScope)
        .groupBy(tenants.status),
      db
        .select({ n: count() })
        .from(tenants)
        .where(and(inScope, gte(tenants.createdAt, d30))),
      db
        .select({ n: count() })
        .from(tenants)
        .where(
          and(inScope, gte(tenants.createdAt, d60), lt(tenants.createdAt, d30)),
        ),
      db
        .select({
          status: subscriptions.status,
          n: count(),
          mrr: sum(monthlyPrice).mapWith(Number),
        })
        .from(subscriptions)
        .where(inArray(subscriptions.tenantId, scope))
        .groupBy(subscriptions.status),
      db
        .select({ n: count() })
        .from(subscriptions)
        .where(
          and(
            inArray(subscriptions.tenantId, scope),
            eq(subscriptions.status, 'trialing'),
            gte(subscriptions.currentPeriodEnd, now),
            lte(
              subscriptions.currentPeriodEnd,
              new Date(now.getTime() + 7 * DAY_MS),
            ),
          ),
        ),
      this.billing(scope, monthStart),
    ]);

    const byStatus = Object.fromEntries(
      statusRows.map((r) => [r.status, r.n]),
    ) as Partial<Record<TenantStatus, number>>;
    const subs = Object.fromEntries(subscriptionRows.map((r) => [r.status, r]));
    const paying = ['active', 'past_due'] as const;

    return {
      tenants: {
        total: statusRows.reduce((a, r) => a + r.n, 0),
        byStatus,
        newLast30Days: recent.n,
        /** % change vs the 30 days before; null when there's nothing to compare. */
        newChange: previous.n
          ? Math.round(((recent.n - previous.n) / previous.n) * 100)
          : null,
      },
      subscriptions: {
        trialing: subs.trialing?.n ?? 0,
        active: subs.active?.n ?? 0,
        pastDue: subs.past_due?.n ?? 0,
        trialsEndingIn7Days: trialsEnding[0].n,
        /** Contractual monthly revenue of paying subscriptions (centimes) — not cash. */
        mrr: Math.round(paying.reduce((a, s) => a + (subs[s]?.mrr ?? 0), 0)),
        /** Same, for subscriptions still in trial: what they'd bring if they convert. */
        trialMrr: Math.round(subs.trialing?.mrr ?? 0),
      },
      billing,
    };
  }

  /** Billed, collected and unpaid — three separate figures, never merged. */
  private async billing(
    scope: ReturnType<DashboardService['scope']>,
    monthStart: Date,
  ) {
    const db = this.database.db;
    const inScope = inArray(invoices.tenantId, scope);
    const [[billed], [collected], [unpaid]] = await Promise.all([
      db
        .select({ amount: sum(invoices.amount).mapWith(Number), n: count() })
        .from(invoices)
        .where(and(inScope, gte(invoices.issuedAt, monthStart))),
      db
        .select({ amount: sum(invoices.amount).mapWith(Number), n: count() })
        .from(invoices)
        .where(
          and(
            inScope,
            eq(invoices.status, 'paid'),
            gte(invoices.paidAt, monthStart),
          ),
        ),
      db
        .select({ amount: sum(invoices.amount).mapWith(Number), n: count() })
        .from(invoices)
        .where(and(inScope, eq(invoices.status, 'overdue'))),
    ]);
    return {
      /** Issued this month (centimes). */
      billedThisMonth: billed.amount ?? 0,
      /** Actually paid this month. */
      collectedThisMonth: collected.amount ?? 0,
      /** Overdue and still unpaid, all months. */
      unpaid: unpaid.amount ?? 0,
      unpaidCount: unpaid.n,
      invoiceCount: billed.n,
    };
  }

  /** Last 12 months: new cabinets, new subscriptions, cancellations. */
  private async series(scope: ReturnType<DashboardService['scope']>) {
    const db = this.database.db;
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1),
    );
    const months = Array.from({ length: MONTHS }, (_, i) => {
      const d = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
      );
      return d.toISOString().slice(0, 7);
    });

    const [created, started, cancelled] = await Promise.all([
      db
        .select({ month: monthOf(tenants.createdAt), n: count() })
        .from(tenants)
        .where(and(inArray(tenants.id, scope), gte(tenants.createdAt, start)))
        .groupBy(sql`1`),
      db
        .select({ month: monthOf(subscriptions.startedAt), n: count() })
        .from(subscriptions)
        .where(
          and(
            inArray(subscriptions.tenantId, scope),
            gte(subscriptions.startedAt, start),
          ),
        )
        .groupBy(sql`1`),
      db
        .select({ month: monthOf(subscriptions.cancelledAt), n: count() })
        .from(subscriptions)
        .where(
          and(
            inArray(subscriptions.tenantId, scope),
            isNotNull(subscriptions.cancelledAt),
            gte(subscriptions.cancelledAt, start),
          ),
        )
        .groupBy(sql`1`),
    ]);
    const at = (rows: { month: string; n: number }[], month: string) =>
      rows.find((r) => r.month === month)?.n ?? 0;
    return months.map((month) => ({
      month,
      newTenants: at(created, month),
      newSubscriptions: at(started, month),
      cancellations: at(cancelled, month),
    }));
  }

  /** Cabinets by plan, city and specialty (top 8, the rest as "Autres"). */
  private async breakdowns(scope: ReturnType<DashboardService['scope']>) {
    const db = this.database.db;
    const inScope = inArray(tenants.id, scope);
    const [byPlan, byCity, bySpecialty] = await Promise.all([
      db
        .select({
          key: subscriptionPlans.key,
          label: subscriptionPlans.name,
          n: count(),
        })
        .from(tenants)
        .leftJoin(subscriptions, liveSubscription)
        .leftJoin(
          subscriptionPlans,
          eq(subscriptionPlans.id, subscriptions.planId),
        )
        .where(inScope)
        .groupBy(
          subscriptionPlans.key,
          subscriptionPlans.name,
          subscriptionPlans.sortOrder,
        )
        .orderBy(asc(subscriptionPlans.sortOrder)),
      db
        .select({ label: tenants.city, n: count() })
        .from(tenants)
        .where(inScope)
        .groupBy(tenants.city)
        .orderBy(desc(count())),
      db
        .select({ label: tenants.specialty, n: count() })
        .from(tenants)
        .where(inScope)
        .groupBy(tenants.specialty)
        .orderBy(desc(count())),
    ]);
    const top = (
      rows: { label: string | null; n: number }[],
      missing: string,
    ) => {
      const named = rows.map((r) => ({
        label: r.label ?? missing,
        value: r.n,
      }));
      if (named.length <= TOP) return named;
      const rest = named.slice(TOP - 1).reduce((a, r) => a + r.value, 0);
      return [...named.slice(0, TOP - 1), { label: 'Autres', value: rest }];
    };
    return {
      plan: byPlan.map((r) => ({
        key: r.key ?? 'none',
        label: r.label ?? 'Sans offre',
        value: r.n,
      })),
      city: top(byCity, 'Ville non renseignée'),
      specialty: top(bySpecialty, 'Non renseignée'),
    };
  }

  /** Platform-wide, unaffected by filters: an incident is never filtered out. */
  private async alerts(): Promise<Alert[]> {
    const db = this.database.db;
    const now = new Date();
    const latest = latestSchemaVersion();
    const [
      unreachable,
      failedMigrations,
      lagging,
      failedRuns,
      scheduled,
      trials,
      overdue,
    ] = await Promise.all([
      db
        .select({
          tenantId: tenants.id,
          name: tenants.name,
          detail: tenantDatabases.lastHealthError,
        })
        .from(tenantDatabases)
        .innerJoin(tenants, eq(tenants.id, tenantDatabases.tenantId))
        .where(
          and(eq(tenantDatabases.healthy, false), ne(tenants.status, 'closed')),
        ),
      db
        .select({
          tenantId: tenants.id,
          name: tenants.name,
          detail: tenantDatabases.lastMigrationError,
        })
        .from(tenantDatabases)
        .innerJoin(tenants, eq(tenants.id, tenantDatabases.tenantId))
        .where(
          and(
            isNotNull(tenantDatabases.lastMigrationError),
            ne(tenants.status, 'closed'),
          ),
        ),
      db
        .select({
          tenantId: tenants.id,
          name: tenants.name,
          detail: tenantDatabases.schemaVersion,
        })
        .from(tenantDatabases)
        .innerJoin(tenants, eq(tenants.id, tenantDatabases.tenantId))
        .where(
          and(
            isNotNull(tenantDatabases.secretRef),
            ne(tenants.status, 'closed'),
            latest
              ? or(
                  isNull(tenantDatabases.schemaVersion),
                  ne(tenantDatabases.schemaVersion, latest),
                )
              : undefined,
          ),
        ),
      // Pending cabinets whose most recent provisioning run failed.
      db
        .selectDistinctOn([tenantProvisioningRuns.tenantId], {
          tenantId: tenants.id,
          name: tenants.name,
          detail: tenantProvisioningRuns.error,
          state: tenantProvisioningRuns.state,
        })
        .from(tenantProvisioningRuns)
        .innerJoin(tenants, eq(tenants.id, tenantProvisioningRuns.tenantId))
        .where(eq(tenants.status, 'pending'))
        .orderBy(
          tenantProvisioningRuns.tenantId,
          desc(tenantProvisioningRuns.startedAt),
        ),
      db
        .select({
          tenantId: tenants.id,
          name: tenants.name,
          toStatus: tenantStatusChanges.toStatus,
          effectiveAt: tenantStatusChanges.effectiveAt,
        })
        .from(tenantStatusChanges)
        .innerJoin(tenants, eq(tenants.id, tenantStatusChanges.tenantId))
        .where(
          and(
            eq(tenantStatusChanges.state, 'scheduled'),
            lte(
              tenantStatusChanges.effectiveAt,
              new Date(now.getTime() + 7 * DAY_MS),
            ),
          ),
        )
        .orderBy(asc(tenantStatusChanges.effectiveAt)),
      db
        .select({
          tenantId: tenants.id,
          name: tenants.name,
          detail: sql<string>`'fin le ' || to_char(${subscriptions.currentPeriodEnd}, 'DD/MM/YYYY')`,
        })
        .from(subscriptions)
        .innerJoin(tenants, eq(tenants.id, subscriptions.tenantId))
        .where(
          and(
            eq(subscriptions.status, 'trialing'),
            gte(subscriptions.currentPeriodEnd, now),
            lte(
              subscriptions.currentPeriodEnd,
              new Date(now.getTime() + 3 * DAY_MS),
            ),
          ),
        )
        .orderBy(asc(subscriptions.currentPeriodEnd)),
      db
        .selectDistinct({ tenantId: tenants.id, name: tenants.name })
        .from(invoices)
        .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
        .where(eq(invoices.status, 'overdue')),
    ]);

    const alert = (
      key: string,
      severity: Alert['severity'],
      title: string,
      rows: { tenantId: string; name: string; detail?: string | null }[],
      href: (first?: string) => string,
    ): Alert => ({
      key,
      severity,
      title,
      count: rows.length,
      items: rows.slice(0, 5).map((r) => ({
        tenantId: r.tenantId,
        name: r.name,
        ...(r.detail && { detail: r.detail }),
      })),
      href: href(rows[0]?.tenantId),
    });

    return [
      alert(
        'db_unreachable',
        'critical',
        'Bases de cabinets injoignables',
        unreachable,
        () => '/technical',
      ),
      alert(
        'migration_failed',
        'critical',
        'Migrations échouées',
        failedMigrations,
        () => '/technical',
      ),
      alert(
        'provisioning_failed',
        'warning',
        'Provisionnements échoués',
        failedRuns.filter((r) => r.state === 'failed'),
        (id) => (id ? `/tenants/${id}?tab=technical` : '/tenants'),
      ),
      alert(
        'schema_behind',
        'warning',
        'Bases en retard de migration',
        lagging,
        () => '/technical',
      ),
      alert(
        'invoices_overdue',
        'warning',
        'Cabinets avec factures impayées',
        overdue,
        () => '/tenants',
      ),
      alert(
        'trials_ending',
        'info',
        'Essais se terminant sous 3 jours',
        trials,
        () => '/tenants',
      ),
      alert(
        'status_scheduled',
        'info',
        'Changements de statut programmés (7 jours)',
        scheduled.map((r) => ({
          tenantId: r.tenantId,
          name: r.name,
          detail: `${STATUS_LABELS[r.toStatus]} le ${r.effectiveAt.toLocaleDateString('fr-MA')}`,
        })),
        (id) => (id ? `/tenants/${id}` : '/tenants'),
      ),
    ].filter((a) => a.count > 0);
  }

  private async filterOptions() {
    const db = this.database.db;
    const [cities, specialties, plans] = await Promise.all([
      db
        .selectDistinct({ v: tenants.city })
        .from(tenants)
        .where(isNotNull(tenants.city))
        .orderBy(asc(tenants.city)),
      db
        .selectDistinct({ v: tenants.specialty })
        .from(tenants)
        .where(isNotNull(tenants.specialty))
        .orderBy(asc(tenants.specialty)),
      db
        .select({ key: subscriptionPlans.key, name: subscriptionPlans.name })
        .from(subscriptionPlans)
        .orderBy(asc(subscriptionPlans.sortOrder)),
    ]);
    return {
      cities: cities.map((r) => r.v!),
      specialties: specialties.map((r) => r.v!),
      plans,
    };
  }
}
