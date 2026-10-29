import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { assertMedical } from '../auth/roles.js';
import { percentChange } from '../dashboard/change.js';
import { SpacesService } from '../spaces/spaces.service.js';
import type { ReportsQuery } from './dto.js';
import {
  addDays,
  type Bucket,
  bucketFor,
  buckets,
  daysBetween,
  MAX_DAYS,
  today,
} from './period.js';

const TZ = `'Africa/Casablanca'`;

/**
 * The period's appointments ($1 first day, $2 last day, both Moroccan
 * days; $3 spaces; $4 one doctor or null), with their local start time.
 */
const SCOPE = `
  a as (
    select a.*, (a.starts_at at time zone ${TZ}) as local
      from appointments a
     where a.space_id = any($3::uuid[])
       and ($4::uuid is null or a.practitioner_id = $4)
       and a.starts_at >= ($1::date::timestamp at time zone ${TZ})
       and a.starts_at < (($2::date + 1)::timestamp at time zone ${TZ})),
  -- A patient's first visit ever in the cabinet (whoever the doctor).
  f as (
    select a.id, not exists (
      select 1 from appointments o
       where o.patient_id = a.patient_id and o.status = 'completed'
         and o.starts_at < a.starts_at) as first
      from a where a.status = 'completed')`;

const PENDING = `('scheduled', 'confirmed', 'arrived', 'in_consultation')`;

type Totals = {
  appointments: number;
  completed: number;
  pending: number;
  noShow: number;
  cancelled: number;
  patients: number;
  newPatients: number;
};

const AGE_GROUPS = [
  { key: '0-14', label: '0–14 ans', max: 14 },
  { key: '15-24', label: '15–24 ans', max: 24 },
  { key: '25-44', label: '25–44 ans', max: 44 },
  { key: '45-64', label: '45–64 ans', max: 64 },
  { key: '65+', label: '65 ans et plus', max: Infinity },
];

const LEAD_TIMES = [
  { key: 'same-day', label: 'Le jour même', max: 0 },
  { key: '1-2', label: '1 à 2 jours', max: 2 },
  { key: '3-7', label: '3 à 7 jours', max: 7 },
  { key: '8-14', label: '8 à 14 jours', max: 14 },
  { key: '15-30', label: '15 à 30 jours', max: 30 },
  { key: '31+', label: 'Plus d’un mois', max: Infinity },
];

const n = (v: string | number | null) => Number(v ?? 0);
/** Share in %, one decimal; null without a base. */
const rate = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

/**
 * Statistiques: what the agenda says about a period — activity, patients,
 * doctors and spaces, busy hours. For the owner (every space, every doctor)
 * and doctors (their spaces; themselves or everyone).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly spaces: SpacesService) {}

  async report(db: Pool, user: ClinicUser, query: ReportsQuery) {
    assertMedical(user);
    const owner = user.role === 'owner';
    const to = query.to ?? today();
    const from = query.from ?? addDays(to, -29);
    const days = daysBetween(from, to);
    if (days < 1 || days > MAX_DAYS) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: `Choisissez une période d’un jour à ${MAX_DAYS} jours.`,
      });
    }
    if (!owner && query.practitioner && query.practitioner !== user.id) {
      throw new ForbiddenException({
        code: 'OWN_FIGURES_ONLY',
        message: 'Vous pouvez voir les chiffres du cabinet ou les vôtres.',
      });
    }
    const accessible = await this.spaces.accessible(db, user);
    const scoped = query.space
      ? accessible.filter((s) => s.id === query.space)
      : accessible;
    if (scoped.length === 0) {
      throw new NotFoundException({
        code: 'SPACE_NOT_FOUND',
        message: 'Espace introuvable.',
      });
    }
    const spaceIds = scoped.map((s) => s.id);
    const practitioner = query.practitioner ?? null;
    const bucket = bucketFor(days);
    const previous = { from: addDays(from, -days), to: addDays(from, -1) };
    const params = [from, to, spaceIds, practitioner];

    const [
      totals,
      before,
      series,
      people,
      byPractitioner,
      bySpace,
      heat,
      lead,
      practitioners,
      revenue,
    ] = await Promise.all([
      this.totals(db, params),
      this.totals(db, [previous.from, previous.to, spaceIds, practitioner]),
      this.series(db, params, bucket),
      this.people(db, params),
      owner ? this.byPractitioner(db, params) : null,
      spaceIds.length > 1 ? this.bySpace(db, params) : null,
      this.heatmap(db, params),
      this.leadTimes(db, params),
      owner ? this.practitioners(db, spaceIds) : null,
      owner ? this.revenue(db, params, previous, bucket) : null,
    ]);

    const change = (key: keyof Totals) =>
      percentChange(totals[key], before[key]);
    const noShowRate = (t: Totals) => rate(t.noShow, t.completed + t.noShow);
    const cancellationRate = (t: Totals) =>
      rate(t.cancelled, t.appointments + t.cancelled);

    return {
      period: { from, to, days, bucket, previous },
      filters: {
        spaces: accessible.map(({ id, name, city }) => ({ id, name, city })),
        space: query.space ?? null,
        /** Owner: every doctor to choose from; doctors choose "me" or everyone. */
        practitioners,
        practitioner,
      },
      activity: {
        totals: {
          ...totals,
          noShowRate: noShowRate(totals),
          cancellationRate: cancellationRate(totals),
        },
        previous: {
          ...before,
          noShowRate: noShowRate(before),
          cancellationRate: cancellationRate(before),
        },
        change: {
          appointments: change('appointments'),
          completed: change('completed'),
          patients: change('patients'),
          newPatients: change('newPatients'),
        },
        series,
      },
      patients: people,
      byPractitioner,
      bySpace,
      affluence: { heatmap: heat, leadTimes: lead },
      /** Encaissements, the owner only. */
      revenue,
    };
  }

  /**
   * Money received in the period (payments minus refunds, by when it was
   * received), by bucket, method and doctor; acts billed for the period's
   * visits; and what those visits still owe.
   */
  private async revenue(
    db: Pool,
    params: unknown[],
    previous: { from: string; to: string },
    bucket: Bucket,
  ) {
    const [from, to, spaceIds, practitioner] = params as [
      string,
      string,
      string[],
      string | null,
    ];
    const moves = `
      m as (
        select p.method, p.received_at at time zone ${TZ} as local, c.practitioner_id,
               case when p.kind = 'payment' then p.amount else -p.amount end as net,
               p.kind
          from payments p join charges c on c.id = p.charge_id
         where p.cancelled_at is null and p.space_id = any($3::uuid[])
           and ($4::uuid is null or c.practitioner_id = $4)
           and p.received_at >= ($1::date::timestamp at time zone ${TZ})
           and p.received_at < (($2::date + 1)::timestamp at time zone ${TZ}))`;
    const total = async (range: unknown[]) =>
      (
        await db.query<{ net: string; received: string; refunded: string }>(
          `with ${moves}
           select coalesce(sum(net), 0) as net,
                  coalesce(sum(net) filter (where kind = 'payment'), 0) as received,
                  coalesce(-sum(net) filter (where kind = 'refund'), 0) as refunded
             from m`,
          range,
        )
      ).rows[0];
    const [now, before, series, byMethod, byPractitioner, byAct, outstanding] =
      await Promise.all([
        total(params),
        total([previous.from, previous.to, spaceIds, practitioner]),
        db.query<{ date: string; net: string }>(
          `with ${moves}
           select to_char(date_trunc($5, local), 'YYYY-MM-DD') as date, sum(net) as net
             from m group by 1`,
          [...params, bucket],
        ),
        db.query<{ method: string; net: string }>(
          `with ${moves} select method, sum(net) as net from m group by 1`,
          params,
        ),
        db.query<{ id: string; name: string; net: string }>(
          `with ${moves}
           select u.id, u.name, sum(m.net) as net
             from m join users u on u.id = m.practitioner_id
            group by u.id order by net desc`,
          params,
        ),
        db.query<{ label: string; count: string; amount: string }>(
          `with ${SCOPE}
           select i.label, sum(i.quantity) as count, sum(i.unit_price * i.quantity) as amount
             from a join charges c on c.appointment_id = a.id
             join charge_items i on i.charge_id = c.id
            group by i.label order by amount desc limit 8`,
          params,
        ),
        db.query<{ amount: string; visits: string }>(
          `with ${SCOPE}
           select coalesce(sum(due), 0) as amount, count(*) as visits from (
             select c.total - coalesce((select sum(case when kind = 'payment' then amount else -amount end)
                                          from payments where charge_id = c.id and cancelled_at is null), 0) as due
               from a join charges c on c.appointment_id = a.id) d
            where due > 0`,
          params,
        ),
      ]);
    const byDate = new Map(series.rows.map((r) => [r.date, n(r.net)]));
    return {
      totals: {
        net: n(now.net),
        received: n(now.received),
        refunded: n(now.refunded),
      },
      previous: { net: n(before.net) },
      change: percentChange(n(now.net), n(before.net)),
      series: buckets(from, to, bucket).map((date) => ({
        date,
        net: byDate.get(date) ?? 0,
      })),
      byMethod: ['cash', 'card', 'cheque', 'transfer'].map((method) => ({
        method,
        net: n(byMethod.rows.find((r) => r.method === method)?.net ?? 0),
      })),
      byPractitioner: byPractitioner.rows.map((r) => ({
        id: r.id,
        name: r.name,
        net: n(r.net),
      })),
      byAct: byAct.rows.map((r) => ({
        label: r.label,
        count: n(r.count),
        amount: n(r.amount),
      })),
      /** Still owed for the period's visits. */
      outstanding: {
        amount: n(outstanding.rows[0].amount),
        visits: n(outstanding.rows[0].visits),
      },
    };
  }

  private async totals(db: Pool, params: unknown[]): Promise<Totals> {
    const { rows } = await db.query<Record<string, string>>(
      `with ${SCOPE}
       select
         count(*) filter (where status <> 'cancelled') as appointments,
         count(*) filter (where status = 'completed') as completed,
         count(*) filter (where status in ${PENDING}) as pending,
         count(*) filter (where status = 'no_show') as no_show,
         count(*) filter (where status = 'cancelled') as cancelled,
         count(distinct patient_id) filter (where status = 'completed') as patients,
         (select count(*) from f where first) as new_patients
       from a`,
      params,
    );
    const r = rows[0];
    return {
      appointments: n(r.appointments),
      completed: n(r.completed),
      pending: n(r.pending),
      noShow: n(r.no_show),
      cancelled: n(r.cancelled),
      patients: n(r.patients),
      newPatients: n(r.new_patients),
    };
  }

  /** Per day, week or month: what became of the appointments, who came. */
  private async series(db: Pool, params: unknown[], bucket: Bucket) {
    const { rows } = await db.query<Record<string, string>>(
      `with ${SCOPE}
       select to_char(date_trunc($5, a.local), 'YYYY-MM-DD') as date,
         count(*) filter (where status = 'completed') as completed,
         count(*) filter (where status in ${PENDING}) as pending,
         count(*) filter (where status = 'no_show') as no_show,
         count(*) filter (where status = 'cancelled') as cancelled,
         count(distinct patient_id) filter (where status = 'completed') as patients,
         count(*) filter (where a.id in (select id from f where first)) as new_patients
       from a group by 1`,
      [...params, bucket],
    );
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const [from, to] = params as [string, string];
    return buckets(from, to, bucket).map((date) => {
      const r = byDate.get(date);
      const patients = n(r?.patients ?? 0);
      const newPatients = n(r?.new_patients ?? 0);
      return {
        date,
        completed: n(r?.completed ?? 0),
        pending: n(r?.pending ?? 0),
        noShow: n(r?.no_show ?? 0),
        cancelled: n(r?.cancelled ?? 0),
        newPatients,
        returningPatients: Math.max(0, patients - newPatients),
      };
    });
  }

  /** The patients seen in the period, by sex, age (at its end) and coverage. */
  private async people(db: Pool, params: unknown[]) {
    const { rows } = await db.query<{
      sex: string;
      coverage: string;
      age: number | null;
      count: string;
    }>(
      `with ${SCOPE}
       select p.sex, p.coverage,
              date_part('year', age($2::date, p.birth_date))::int as age,
              count(*)
         from patients p
        where p.id in (select patient_id from a where status = 'completed')
        group by 1, 2, 3`,
      params,
    );
    const sum = (keyOf: (r: (typeof rows)[number]) => string) => {
      const counts = new Map<string, number>();
      for (const r of rows)
        counts.set(keyOf(r), (counts.get(keyOf(r)) ?? 0) + n(r.count));
      return counts;
    };
    const sex = sum((r) => r.sex);
    const coverage = sum((r) => r.coverage);
    const age = sum((r) =>
      r.age === null ? 'unknown' : AGE_GROUPS.find((g) => r.age! <= g.max)!.key,
    );
    return {
      sex: { male: sex.get('male') ?? 0, female: sex.get('female') ?? 0 },
      age: [
        ...AGE_GROUPS.map((g) => ({
          key: g.key,
          label: g.label,
          count: age.get(g.key) ?? 0,
        })),
        {
          key: 'unknown',
          label: 'Âge inconnu',
          count: age.get('unknown') ?? 0,
        },
      ],
      coverage: [...coverage]
        .map(([key, count]) => ({ key, count }))
        .sort((x, y) => y.count - x.count),
    };
  }

  private async byPractitioner(db: Pool, params: unknown[]) {
    const { rows } = await db.query<Record<string, string>>(
      `with ${SCOPE}
       select u.id, u.name, u.role,
         count(*) filter (where a.status <> 'cancelled') as appointments,
         count(*) filter (where a.status = 'completed') as completed,
         count(*) filter (where a.status = 'no_show') as no_show,
         count(distinct a.patient_id) filter (where a.status = 'completed') as patients
       from a join users u on u.id = a.practitioner_id
       group by u.id order by completed desc, u.name`,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      appointments: n(r.appointments),
      completed: n(r.completed),
      patients: n(r.patients),
      noShowRate: rate(n(r.no_show), n(r.completed) + n(r.no_show)),
    }));
  }

  private async bySpace(db: Pool, params: unknown[]) {
    const { rows } = await db.query<Record<string, string>>(
      `with ${SCOPE}
       select s.id, s.name, s.city,
         count(a.id) filter (where a.status <> 'cancelled') as appointments,
         count(a.id) filter (where a.status = 'completed') as completed,
         count(a.id) filter (where a.status = 'no_show') as no_show,
         count(distinct a.patient_id) filter (where a.status = 'completed') as patients,
         count(a.id) filter (where a.id in (select id from f where first)) as new_patients
       from spaces s left join a on a.space_id = s.id
       where s.id = any($3::uuid[])
       group by s.id order by s.created_at, s.name`,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      appointments: n(r.appointments),
      completed: n(r.completed),
      patients: n(r.patients),
      newPatients: n(r.new_patients),
      noShowRate: rate(n(r.no_show), n(r.completed) + n(r.no_show)),
    }));
  }

  /** Appointments kept (not cancelled) by weekday (1 = Monday … 7) and hour. */
  private async heatmap(db: Pool, params: unknown[]) {
    const { rows } = await db.query<Record<string, string>>(
      `with ${SCOPE}
       select extract(isodow from local)::int as weekday,
              extract(hour from local)::int as hour, count(*)
         from a where status <> 'cancelled' group by 1, 2`,
      params,
    );
    return rows.map((r) => ({
      weekday: n(r.weekday),
      hour: n(r.hour),
      count: n(r.count),
    }));
  }

  /** How long before the day the appointments were booked. */
  private async leadTimes(db: Pool, params: unknown[]) {
    const { rows } = await db.query<{ days: number; count: string }>(
      `with ${SCOPE}
       select greatest(0, local::date - (created_at at time zone ${TZ})::date) as days,
              count(*)
         from a where status <> 'cancelled' group by 1`,
      params,
    );
    const total = rows.reduce((s, r) => s + n(r.count), 0);
    // Median: the day count half the appointments are booked within.
    let median: number | null = null;
    let seen = 0;
    for (const r of [...rows].sort((x, y) => x.days - y.days)) {
      seen += n(r.count);
      if (seen * 2 >= total) {
        median = r.days;
        break;
      }
    }
    return {
      median,
      buckets: LEAD_TIMES.map((b, i) => ({
        key: b.key,
        label: b.label,
        count: rows
          .filter(
            (r) =>
              r.days <= b.max && (i === 0 || r.days > LEAD_TIMES[i - 1].max),
          )
          .reduce((s, r) => s + n(r.count), 0),
      })),
    };
  }

  /** Doctors who work (or worked) in these spaces, to filter by. */
  private async practitioners(db: Pool, spaceIds: string[]) {
    const { rows } = await db.query<{ id: string; name: string }>(
      `select u.id, u.name from users u
        where u.role = 'owner'
           or (u.role = 'doctor' and (
                exists (select 1 from space_members m
                         where m.user_id = u.id and m.space_id = any($1::uuid[]))
             or exists (select 1 from appointments a
                         where a.practitioner_id = u.id and a.space_id = any($1::uuid[]))))
        order by u.role = 'owner' desc, u.name`,
      [spaceIds],
    );
    return rows;
  }
}
