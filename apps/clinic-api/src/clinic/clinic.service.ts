import type { Pool } from '@neondatabase/serverless';
import { Injectable } from '@nestjs/common';
import { CatalogService } from '../database/catalog.module.js';

type OfferRow = {
  plan: string | null;
  status: string | null;
  current_period_end: Date | null;
  max_doctors: number | null;
  max_secretaries: number | null;
  storage_quota_mb: number | null;
  size_bytes: string | null;
  quote_pending: boolean;
};

/** What the cabinet's staff may see about their offer, set by the platform. */
@Injectable()
export class ClinicService {
  constructor(private readonly catalog: CatalogService) {}

  async subscription(tenantId: string, db: Pool) {
    const [{ rows }, team] = await Promise.all([
      this.catalog.pool.query<OfferRow>(
        `select p.name as plan, s.status, s.current_period_end,
                exists (
                  select 1 from quotes q
                   where q.tenant_id = t.id and q.status = 'pending'
                ) as quote_pending,
                t.max_doctors, t.max_secretaries, t.storage_quota_mb,
                db.size_bytes
           from tenants t
           left join lateral (
             select * from subscriptions
              where tenant_id = t.id and status <> 'cancelled'
              order by started_at desc limit 1
           ) s on true
           left join subscription_plans p on p.id = s.plan_id
           left join tenant_databases db on db.tenant_id = t.id
          where t.id = $1`,
        [tenantId],
      ),
      db.query<{ role: string; count: string }>(
        'select role, count(*) from users where active group by role',
      ),
    ]);
    const offer = rows[0];
    const count = (...roles: string[]) =>
      team.rows
        .filter((r) => roles.includes(r.role))
        .reduce((n, r) => n + Number(r.count), 0);

    return {
      plan: offer?.plan ?? null,
      status: offer?.status ?? null,
      // While trialing, the current period is the trial.
      trialEndsAt:
        offer?.status === 'trialing' ? offer.current_period_end : null,
      currentPeriodEnd: offer?.current_period_end ?? null,
      quotePending: offer?.quote_pending ?? false,
      doctors: {
        used: count('owner', 'doctor'),
        max: offer?.max_doctors ?? null,
      },
      secretaries: {
        used: count('secretary'),
        max: offer?.max_secretaries ?? null,
      },
      storage: {
        usedMb: offer?.size_bytes
          ? Math.round(Number(offer.size_bytes) / 1024 / 1024)
          : null,
        quotaMb: offer?.storage_quota_mb ?? null,
      },
    };
  }
}
