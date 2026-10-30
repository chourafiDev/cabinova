import type { Pool } from '@neondatabase/serverless';
import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../database/catalog.module.js';

const LIST_LIMIT = 30;
/** Older notifications are dropped; a paid facture is announced this long. */
const KEEP_DAYS = 90;
const PAID_INVOICE_DAYS = 60;
const TZ = 'Africa/Casablanca';

type Notification = {
  userId: string;
  kind: 'arrived' | 'no_show' | 'cancelled' | 'team' | 'billing';
  title: string;
  body: string | null;
  href: string | null;
  dedupeKey: string;
};

const mad = (centimes: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(
    centimes / 100,
  );

/**
 * The bell. Things that happen in the cabinet are written when they happen;
 * billing lives in the catalog, so the responsible doctor's devis and
 * factures are copied here each time the list is read. Writing one never
 * breaks what triggered it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly catalog: CatalogService) {}

  async list(db: Pool, tenantId: string, user: { id: string; role: string }) {
    if (user.role === 'owner') await this.syncBilling(db, tenantId, user.id);
    await db.query(
      `delete from notifications
        where user_id = $1 and created_at < now() - make_interval(days => $2)`,
      [user.id, KEEP_DAYS],
    );
    const [{ rows }, unread] = await Promise.all([
      db.query(
        `select id, kind, title, body, href, read_at as "readAt", created_at as "createdAt"
           from notifications where user_id = $1
          order by created_at desc limit ${LIST_LIMIT}`,
        [user.id],
      ),
      db.query<{ count: number }>(
        `select count(*)::int from notifications
          where user_id = $1 and read_at is null`,
        [user.id],
      ),
    ]);
    return { data: rows, unread: unread.rows[0].count };
  }

  async markRead(db: Pool, userId: string, id: string) {
    await db.query(
      `update notifications set read_at = coalesce(read_at, now())
        where id = $1 and user_id = $2`,
      [id, userId],
    );
  }

  async markAllRead(db: Pool, userId: string) {
    await db.query(
      `update notifications set read_at = now()
        where user_id = $1 and read_at is null`,
      [userId],
    );
  }

  /** A patient arrived, didn't come, or cancelled: who needs to know. */
  async appointmentChanged(
    db: Pool,
    id: string,
    status: string,
    actorId: string,
  ) {
    if (!['arrived', 'no_show', 'cancelled'].includes(status)) return;
    try {
      const { rows } = await db.query<{
        practitioner_id: string;
        patient: string;
        time: string;
        day: string;
        space: string | null;
      }>(
        `select a.practitioner_id,
                upper(p.last_name) || ' ' || p.first_name as patient,
                to_char(a.starts_at at time zone '${TZ}', 'HH24:MI') as time,
                to_char(a.starts_at at time zone '${TZ}', 'YYYY-MM-DD') as day,
                case when (select count(*) from spaces where active) > 1
                     then s.name end as space
           from appointments a
           join patients p on p.id = a.patient_id
           join spaces s on s.id = a.space_id
          where a.id = $1`,
        [id],
      );
      const a = rows[0];
      if (!a) return;
      const title = {
        arrived: `${a.patient} est en salle d’attente`,
        no_show: `${a.patient} n’est pas venu(e)`,
        cancelled: `Rendez-vous de ${a.patient} annulé`,
      }[status]!;
      // The doctor concerned; an absence also matters to the owner.
      const recipients = new Set([a.practitioner_id]);
      if (status === 'no_show') {
        const { rows: owners } = await db.query<{ id: string }>(
          `select id from users where role = 'owner' and active`,
        );
        for (const owner of owners) recipients.add(owner.id);
      }
      recipients.delete(actorId);
      await this.write(
        db,
        [...recipients].map((userId) => ({
          userId,
          kind: status as Notification['kind'],
          title,
          body: [`Rendez-vous de ${a.time}`, a.space]
            .filter(Boolean)
            .join(' · '),
          href: `/appointments?view=day&date=${a.day}`,
          dedupeKey: `appointment:${id}:${status}`,
        })),
      );
    } catch (err) {
      this.logger.error('Appointment notification failed', err);
    }
  }

  /** An invited member chose their password. */
  async memberJoined(db: Pool, memberId: string) {
    try {
      const { rows } = await db.query<{
        owner: string;
        name: string;
        role: string;
      }>(
        `select o.id as owner, m.name, m.role
           from users o, users m
          where o.role = 'owner' and o.active and m.id = $1 and o.id <> m.id`,
        [memberId],
      );
      await this.write(
        db,
        rows.map((r) => ({
          userId: r.owner,
          kind: 'team',
          title: `${r.name} a rejoint votre équipe`,
          body: null,
          href: '/staff',
          dedupeKey: `team:${memberId}`,
        })),
      );
    } catch (err) {
      this.logger.error('Team notification failed', err);
    }
  }

  /** The devis and factures of the catalog as they stand, once per state. */
  private async syncBilling(db: Pool, tenantId: string, userId: string) {
    try {
      const [quotes, invoices] = await Promise.all([
        this.catalog.pool.query<{ id: string; number: string; amount: number }>(
          `select id, number, amount from quotes
            where tenant_id = $1 and status = 'pending'`,
          [tenantId],
        ),
        this.catalog.pool.query<{
          id: string;
          number: string;
          amount: number;
          status: 'billed' | 'overdue' | 'paid';
        }>(
          `select id, number, amount, status from invoices
            where tenant_id = $1
              and (status in ('billed', 'overdue')
                or (status = 'paid' and paid_at > now() - make_interval(days => $2)))`,
          [tenantId, PAID_INVOICE_DAYS],
        ),
      ]);
      const titles = {
        billed: 'à régler',
        overdue: 'en retard',
        paid: 'disponible',
      };
      const items: Notification[] = [
        ...quotes.rows.map((q) => ({
          userId,
          kind: 'billing' as const,
          title: `Devis ${q.number} à régler`,
          body: mad(q.amount),
          href: `/devis/${q.id}`,
          dedupeKey: `quote:${q.id}`,
        })),
        ...invoices.rows.map((i) => ({
          userId,
          kind: 'billing' as const,
          title: `Facture ${i.number} ${titles[i.status]}`,
          body: mad(i.amount),
          href: `/factures/${i.id}`,
          dedupeKey: `invoice:${i.id}:${i.status}`,
        })),
      ];
      await this.write(db, items);
      // A devis paid or a facture settled no longer asks for anything.
      await db.query(
        `delete from notifications
          where user_id = $1 and kind = 'billing' and dedupe_key <> all($2)`,
        [userId, items.map((n) => n.dedupeKey)],
      );
    } catch (err) {
      this.logger.error('Billing notifications failed', err);
    }
  }

  private async write(db: Pool, items: Notification[]) {
    for (const n of items) {
      await db.query(
        `insert into notifications (user_id, kind, title, body, href, dedupe_key)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (user_id, dedupe_key) do nothing`,
        [n.userId, n.kind, n.title, n.body, n.href, n.dedupeKey],
      );
    }
  }
}
