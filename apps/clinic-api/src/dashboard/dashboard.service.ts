import type { Pool } from '@neondatabase/serverless';
import { Injectable } from '@nestjs/common';
import { noShowsOf } from '../patients/no-shows.js';
import { addDays, type Bucket, bucketFor, buckets, daysBetween } from '../reports/period.js';
import { percentChange } from './change.js';

const TZ = `'Africa/Casablanca'`;

// Today in Moroccan time, computed by Postgres (Morocco moves to UTC+0
// during Ramadan: no fixed offset in code).
const TODAY = `
  with b as (select (now() at time zone ${TZ})::date as d),
  r as (select
    (b.d::timestamp at time zone ${TZ}) as day_start,
    ((b.d + 1)::timestamp at time zone ${TZ}) as day_end
  from b)`;

/** Moroccan days $from..$to (both included) as a timestamptz range test on `col`. */
const within = (col: string, from: string, to: string) =>
  `${col} >= (${from}::date::timestamp at time zone ${TZ})
   and ${col} < ((${to}::date + 1)::timestamp at time zone ${TZ})`;

/** Money in minus refunds, for payments matching `where`. */
const NET = `coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)`;

export type Period = { from: string; to: string };

/**
 * The clinic dashboard from the agenda and the patients: figures and
 * activity over a period, plus today's appointments and waiting room, for
 * one space — or, for the owner, every space added up with a line per space.
 */
@Injectable()
export class DashboardService {
  async overview(
    db: Pool,
    spaceIds: string[],
    withToday: boolean,
    owner: boolean,
    { from, to }: Period,
  ) {
    const days = daysBetween(from, to);
    const bucket = bucketFor(days);
    const previous = { from: addDays(from, -days), to: addDays(from, -1) };
    const period = [spaceIds, from, to, previous.from, previous.to];

    const [kpis, series, today, bySpace, cashier] = await Promise.all([
      db.query<{
        appointments: string;
        pending: string;
        seen: string;
        seen_before: string;
        new_patients: string;
        new_patients_before: string;
        upcoming_today: string;
        today: string;
      }>(
        `${TODAY}
         select
           (select count(*) from appointments a where a.space_id = any($1) and a.status <> 'cancelled'
              and ${within('a.starts_at', '$2', '$3')}) as appointments,
           (select count(*) from appointments a where a.space_id = any($1)
              and a.status in ('scheduled', 'confirmed', 'arrived', 'in_consultation')
              and ${within('a.starts_at', '$2', '$3')}) as pending,
           (select count(*) from appointments a where a.space_id = any($1) and a.status = 'completed'
              and ${within('a.starts_at', '$2', '$3')}) as seen,
           (select count(*) from appointments a where a.space_id = any($1) and a.status = 'completed'
              and ${within('a.starts_at', '$4', '$5')}) as seen_before,
           (select count(*) from patients p where p.space_id = any($1)
              and ${within('p.created_at', '$2', '$3')}) as new_patients,
           (select count(*) from patients p where p.space_id = any($1)
              and ${within('p.created_at', '$4', '$5')}) as new_patients_before,
           (select count(*) from appointments a where a.space_id = any($1)
              and a.status in ('scheduled', 'confirmed', 'arrived', 'in_consultation')
              and a.starts_at >= r.day_start and a.starts_at < r.day_end) as upcoming_today,
           (select to_char(d, 'YYYY-MM-DD') from b) as today
         from r`,
        period,
      ),
      this.series(db, spaceIds, { from, to }, bucket),
      withToday
        ? db.query(
            `${TODAY}
             select a.id, a.starts_at as "startsAt", a.ends_at as "endsAt", a.status, a.reason,
               a.arrived_at as "arrivedAt", a.walk_in as "walkIn", a.left_at as "leftAt",
               json_build_object('id', p.id, 'firstName', p.first_name, 'lastName', p.last_name,
                 'fileNumber', p.file_number, 'phone', p.phone,
                 'birthDate', to_char(p.birth_date, 'YYYY-MM-DD'), 'sex', p.sex,
                 'noShows', ${noShowsOf('p.id')}) as patient,
               json_build_object('id', u.id, 'name', u.name) as practitioner,
               not exists (select 1 from appointments o where o.patient_id = a.patient_id
                 and o.status = 'completed' and o.starts_at < a.starts_at) as "firstVisit"
             from r, appointments a
               join patients p on p.id = a.patient_id
               join users u on u.id = a.practitioner_id
             where a.space_id = any($1) and a.status <> 'cancelled'
               and a.starts_at >= r.day_start and a.starts_at < r.day_end
             order by a.starts_at`,
            [spaceIds],
          )
        : null,
      spaceIds.length > 1
        ? db.query<{
            id: string;
            name: string;
            city: string | null;
            appointments: string;
            waiting: string;
            seen: string;
            new_patients: string;
          }>(
            `${TODAY}
             select s.id, s.name, s.city,
               (select count(*) from appointments a where a.space_id = s.id and a.status <> 'cancelled'
                  and ${within('a.starts_at', '$2', '$3')}) as appointments,
               (select count(*) from appointments a where a.space_id = s.id and a.status = 'arrived'
                  and a.starts_at >= r.day_start and a.starts_at < r.day_end) as waiting,
               (select count(*) from appointments a where a.space_id = s.id and a.status = 'completed'
                  and ${within('a.starts_at', '$2', '$3')}) as seen,
               (select count(*) from patients p where p.space_id = s.id
                  and ${within('p.created_at', '$2', '$3')}) as new_patients
             from r, spaces s where s.id = any($1)
             order by s.created_at, s.name`,
            [spaceIds, from, to],
          )
        : null,
      db.query<{
        to_collect: string;
        received: string | null;
        received_before: string | null;
      }>(
        `select
           (select count(*) from appointments a
              left join charges c on c.appointment_id = a.id
             where a.space_id = any($1) and a.status = 'completed'
               and ${within('a.starts_at', '$2', '$3')}
               and (c.id is null or c.total > (
                 select ${NET} from payments where charge_id = c.id and cancelled_at is null))) as to_collect,
           case when $6 then (select ${NET} from payments p where p.space_id = any($1)
               and p.cancelled_at is null and ${within('p.received_at', '$2', '$3')}) end as received,
           case when $6 then (select ${NET} from payments p where p.space_id = any($1)
               and p.cancelled_at is null and ${within('p.received_at', '$4', '$5')}) end as received_before`,
        [...period, owner],
      ),
    ]);

    const k = kpis.rows[0];
    const c = cashier.rows[0];
    const n = (v: string) => Number(v);
    return {
      /** Today, in Moroccan time. */
      date: k.today,
      period: { from, to, days, bucket, previous },
      kpis: {
        appointments: n(k.appointments),
        pending: n(k.pending),
        seen: n(k.seen),
        seenChange: percentChange(n(k.seen), n(k.seen_before)),
        newPatients: n(k.new_patients),
        newPatientsChange: percentChange(
          n(k.new_patients),
          n(k.new_patients_before),
        ),
        /** For the welcome line: still to come today, whatever the period. */
        upcomingToday: n(k.upcoming_today),
      },
      series,
      appointments: today?.rows ?? null,
      /** The period's finished visits still to check out; money is the owner's. */
      cashier: {
        toCollect: n(c.to_collect),
        received: c.received === null ? null : n(c.received),
        receivedChange:
          c.received === null
            ? null
            : percentChange(n(c.received), n(c.received_before ?? '0')),
      },
      bySpace:
        bySpace?.rows.map((s) => ({
          id: s.id,
          name: s.name,
          city: s.city,
          appointments: n(s.appointments),
          waiting: n(s.waiting),
          seen: n(s.seen),
          newPatients: n(s.new_patients),
        })) ?? null,
    };
  }

  /** Booked (not cancelled or absent) vs done, per day, week or month. */
  private async series(
    db: Pool,
    spaceIds: string[],
    { from, to }: Period,
    bucket: Bucket,
  ) {
    const { rows } = await db.query<{
      date: string;
      appointments: string;
      consultations: string;
    }>(
      `select to_char(date_trunc($4, a.starts_at at time zone ${TZ}), 'YYYY-MM-DD') as date,
         count(*) filter (where a.status not in ('cancelled', 'no_show')) as appointments,
         count(*) filter (where a.status = 'completed') as consultations
       from appointments a
       where a.space_id = any($1) and ${within('a.starts_at', '$2', '$3')}
       group by 1`,
      [spaceIds, from, to, bucket],
    );
    const byDate = new Map(rows.map((r) => [r.date, r]));
    return buckets(from, to, bucket).map((date) => ({
      date,
      appointments: Number(byDate.get(date)?.appointments ?? 0),
      consultations: Number(byDate.get(date)?.consultations ?? 0),
    }));
  }
}
