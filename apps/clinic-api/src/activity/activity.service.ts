import type { Pool } from '@neondatabase/serverless';
import { Injectable, Logger } from '@nestjs/common';
import type { ListActivityQuery } from './dto.js';

const PER_PAGE = 50;
const KEEP_MONTHS = 12;
const TZ = 'Africa/Casablanca';

/** What an entry is about, resolved to words while it still exists. */
export type ActivityEntity =
  'patient' | 'appointment' | 'member' | 'act' | 'space' | 'payment' | 'charge';

const PATIENT_NAME = `upper(p.last_name) || ' ' || p.first_name`;

const DESCRIBE: Record<ActivityEntity, string> = {
  patient: `select ${PATIENT_NAME} as target from patients p where p.id = $1`,
  appointment: `select ${PATIENT_NAME} || ' · ' ||
                  to_char(a.starts_at at time zone '${TZ}', 'DD/MM/YYYY HH24:MI') as target
                  from appointments a join patients p on p.id = a.patient_id
                 where a.id = $1`,
  member: 'select name as target from users where id = $1',
  act: 'select name as target from acts where id = $1',
  space: 'select name as target from spaces where id = $1',
  payment: `select ${PATIENT_NAME} || coalesce(' · ' || c.receipt_number, '') as target
              from payments c join patients p on p.id = c.patient_id
             where c.id = $1`,
  charge: `select ${PATIENT_NAME} as target
             from charges c join patients p on p.id = c.patient_id
            where c.id = $1`,
};

/** The prefixes of each filter in the journal. */
const CATEGORIES: Record<string, string[]> = {
  patients: ['patient.'],
  appointments: ['appointment.'],
  payments: ['payment.', 'cashier.', 'act.'],
  team: ['team.'],
  security: ['auth.'],
  settings: ['space.', 'settings.'],
};

export type ActivityEntry = {
  action: string;
  actor?: { id: string | null; name: string | null };
  entity?: ActivityEntity;
  entityId?: string;
  target?: string | null;
  detail?: string | null;
  ip?: string;
};

/**
 * The cabinet's journal: who did what, kept a year, for the responsible
 * doctor. It says what happened and to whom, never any medical content.
 * Writing an entry never breaks what it records.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  async describe(db: Pool, entity: ActivityEntity, id: string) {
    const { rows } = await db.query<{ target: string }>(DESCRIBE[entity], [id]);
    return rows[0]?.target ?? null;
  }

  async record(db: Pool, entry: ActivityEntry) {
    try {
      await db.query(
        `insert into activity_logs
           (user_id, actor_name, action, entity, entity_id, target, detail, ip)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.actor?.id ?? null,
          entry.actor?.name ?? null,
          entry.action,
          entry.entity ?? null,
          entry.entityId ?? null,
          entry.target ?? null,
          entry.detail ?? null,
          entry.ip ?? null,
        ],
      );
    } catch (err) {
      this.logger.error(`Activity ${entry.action} failed`, err);
    }
  }

  /** At most one entry per person, action and record, per hour. */
  async recordHourly(db: Pool, entry: ActivityEntry) {
    const { rowCount } = await db.query(
      `select 1 from activity_logs
        where user_id = $1 and action = $2 and entity_id = $3
          and created_at > now() - interval '1 hour' limit 1`,
      [entry.actor?.id, entry.action, entry.entityId],
    );
    if (!rowCount) await this.record(db, entry);
  }

  /** Run at each sign-in: every cabinet gets there, active or not. */
  async prune(db: Pool) {
    try {
      await db.query(
        `delete from activity_logs
          where created_at < now() - make_interval(months => $1)`,
        [KEEP_MONTHS],
      );
    } catch (err) {
      this.logger.error('Activity prune failed', err);
    }
  }

  async list(db: Pool, query: ListActivityQuery) {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: (n: number) => string, value: unknown) => {
      params.push(value);
      where.push(sql(params.length));
    };
    if (query.category) {
      const prefixes = CATEGORIES[query.category];
      add(
        (n) => `action like any($${n})`,
        prefixes.map((p) => `${p}%`),
      );
    }
    if (query.userId) add((n) => `user_id = $${n}`, query.userId);
    if (query.search) {
      add(
        (n) => `(target ilike $${n} or actor_name ilike $${n})`,
        `%${query.search.replace(/[%_\\]/g, '\\$&')}%`,
      );
    }
    const filter = where.length ? `where ${where.join(' and ')}` : '';
    const page = query.page ?? 1;
    const [{ rows }, count, people] = await Promise.all([
      db.query(
        `select id, user_id as "userId", actor_name as "actorName", action,
                target, detail, ip, created_at as "createdAt"
           from activity_logs ${filter}
          order by created_at desc, id
          limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
        params,
      ),
      db.query<{ count: number }>(
        `select count(*)::int from activity_logs ${filter}`,
        params,
      ),
      db.query<{ id: string; name: string }>(
        'select id, name from users order by name',
      ),
    ]);
    return {
      data: rows,
      total: count.rows[0].count,
      pageCount: Math.max(1, Math.ceil(count.rows[0].count / PER_PAGE)),
      people: people.rows,
    };
  }
}
