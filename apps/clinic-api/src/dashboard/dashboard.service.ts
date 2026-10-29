import type { Pool } from '@neondatabase/serverless';
import { Injectable } from '@nestjs/common';
import { percentChange } from './change.js';

// Day, week and month in Moroccan time, computed by Postgres (Morocco moves
// to UTC+0 during Ramadan: no fixed offset in code).
const BOUNDS = `
  with b as (select (now() at time zone 'Africa/Casablanca')::date as d),
  r as (select
    (b.d::timestamp at time zone 'Africa/Casablanca') as day_start,
    ((b.d + 1)::timestamp at time zone 'Africa/Casablanca') as day_end,
    ((b.d - 7)::timestamp at time zone 'Africa/Casablanca') as last_week_start,
    ((b.d - 6)::timestamp at time zone 'Africa/Casablanca') as last_week_end,
    (date_trunc('month', b.d)::timestamp at time zone 'Africa/Casablanca') as month_start,
    ((date_trunc('month', b.d) - interval '1 month')::timestamp at time zone 'Africa/Casablanca') as prev_month_start,
    (date_trunc('week', b.d)::date) as monday
  from b)`;

/**
 * The clinic dashboard from the agenda and the patients: today's
 * appointments, waiting room, figures and the week, for one space — or,
 * for the owner, every space added up with a line per space.
 */
@Injectable()
export class DashboardService {
  async overview(
    db: Pool,
    spaceIds: string[],
    withToday: boolean,
    owner = false,
  ) {
    const [kpis, week, today, bySpace, cashier] = await Promise.all([
      db.query<{
        appointments_today: string;
        upcoming_today: string;
        seen_today: string;
        seen_last_week: string;
        new_patients_month: string;
        new_patients_prev_month: string;
        today: string;
      }>(
        `${BOUNDS}
         select
           (select count(*) from appointments a where a.space_id = any($1) and a.status <> 'cancelled'
              and a.starts_at >= r.day_start and a.starts_at < r.day_end) as appointments_today,
           (select count(*) from appointments a where a.space_id = any($1)
              and a.status in ('scheduled', 'confirmed', 'arrived', 'in_consultation')
              and a.starts_at >= r.day_start and a.starts_at < r.day_end) as upcoming_today,
           (select count(*) from appointments a where a.space_id = any($1) and a.status = 'completed'
              and a.starts_at >= r.day_start and a.starts_at < r.day_end) as seen_today,
           (select count(*) from appointments a where a.space_id = any($1) and a.status = 'completed'
              and a.starts_at >= r.last_week_start and a.starts_at < r.last_week_end) as seen_last_week,
           (select count(*) from patients p where p.space_id = any($1)
              and p.created_at >= r.month_start) as new_patients_month,
           (select count(*) from patients p where p.space_id = any($1)
              and p.created_at >= r.prev_month_start and p.created_at < r.month_start) as new_patients_prev_month,
           (select to_char(d, 'YYYY-MM-DD') from b) as today
         from r`,
        [spaceIds],
      ),
      db.query<{ date: string; appointments: string; consultations: string }>(
        `${BOUNDS}
         select to_char(day, 'YYYY-MM-DD') as date,
           (select count(*) from appointments a where a.space_id = any($1)
              and a.status not in ('cancelled', 'no_show')
              and a.starts_at >= (day::timestamp at time zone 'Africa/Casablanca')
              and a.starts_at < ((day + 1)::timestamp at time zone 'Africa/Casablanca')) as appointments,
           (select count(*) from appointments a where a.space_id = any($1) and a.status = 'completed'
              and a.starts_at >= (day::timestamp at time zone 'Africa/Casablanca')
              and a.starts_at < ((day + 1)::timestamp at time zone 'Africa/Casablanca')) as consultations
         from r, generate_series(r.monday::timestamp, r.monday::timestamp + interval '5 days',
                                 interval '1 day') as g(ts),
              lateral (select g.ts::date as day) d
         order by day`,
        [spaceIds],
      ),
      withToday
        ? db.query(
            `${BOUNDS}
             select a.id, a.starts_at as "startsAt", a.ends_at as "endsAt", a.status, a.reason,
               a.arrived_at as "arrivedAt",
               json_build_object('id', p.id, 'firstName', p.first_name, 'lastName', p.last_name,
                 'fileNumber', p.file_number, 'phone', p.phone,
                 'birthDate', to_char(p.birth_date, 'YYYY-MM-DD'), 'sex', p.sex) as patient,
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
            appointments_today: string;
            waiting: string;
            seen_today: string;
            new_patients_month: string;
          }>(
            `${BOUNDS}
             select s.id, s.name, s.city,
               (select count(*) from appointments a where a.space_id = s.id and a.status <> 'cancelled'
                  and a.starts_at >= r.day_start and a.starts_at < r.day_end) as appointments_today,
               (select count(*) from appointments a where a.space_id = s.id and a.status = 'arrived'
                  and a.starts_at >= r.day_start and a.starts_at < r.day_end) as waiting,
               (select count(*) from appointments a where a.space_id = s.id and a.status = 'completed'
                  and a.starts_at >= r.day_start and a.starts_at < r.day_end) as seen_today,
               (select count(*) from patients p where p.space_id = s.id
                  and p.created_at >= r.month_start) as new_patients_month
             from r, spaces s where s.id = any($1)
             order by s.created_at, s.name`,
            [spaceIds],
          )
        : null,
      db.query<{
        to_collect: string;
        received: string | null;
        received_last_week: string | null;
      }>(
        `${BOUNDS}
         select
           (select count(*) from appointments a
              left join charges c on c.appointment_id = a.id
             where a.space_id = any($1) and a.status = 'completed'
               and a.starts_at >= r.day_start and a.starts_at < r.day_end
               and (c.id is null or c.total > (
                 select coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)
                   from payments where charge_id = c.id and cancelled_at is null))) as to_collect,
           case when $2 then (select coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)
              from payments p where p.space_id = any($1) and p.cancelled_at is null
               and p.received_at >= r.day_start and p.received_at < r.day_end) end as received,
           case when $2 then (select coalesce(sum(case when kind = 'payment' then amount else -amount end), 0)
              from payments p where p.space_id = any($1) and p.cancelled_at is null
               and p.received_at >= r.last_week_start and p.received_at < r.last_week_end) end as received_last_week
         from r`,
        [spaceIds, owner],
      ),
    ]);

    const k = kpis.rows[0];
    const n = (v: string) => Number(v);
    return {
      /** Today, in Moroccan time. */
      date: k.today,
      kpis: {
        appointmentsToday: n(k.appointments_today),
        upcomingToday: n(k.upcoming_today),
        seenToday: n(k.seen_today),
        seenChange: percentChange(n(k.seen_today), n(k.seen_last_week)),
        newPatientsMonth: n(k.new_patients_month),
        newPatientsChange: percentChange(
          n(k.new_patients_month),
          n(k.new_patients_prev_month),
        ),
      },
      week: week.rows.map((d) => ({
        date: d.date,
        appointments: n(d.appointments),
        consultations: n(d.consultations),
      })),
      appointments: today?.rows ?? null,
      /** Encaissements today: finished visits still to check out; money is the owner's. */
      cashier: {
        toCollect: n(cashier.rows[0].to_collect),
        received:
          cashier.rows[0].received === null
            ? null
            : n(cashier.rows[0].received),
        receivedChange:
          cashier.rows[0].received === null
            ? null
            : percentChange(
                n(cashier.rows[0].received),
                n(cashier.rows[0].received_last_week ?? '0'),
              ),
      },
      bySpace:
        bySpace?.rows.map((s) => ({
          id: s.id,
          name: s.name,
          city: s.city,
          appointmentsToday: n(s.appointments_today),
          waiting: n(s.waiting),
          seenToday: n(s.seen_today),
          newPatientsMonth: n(s.new_patients_month),
        })) ?? null,
    };
  }
}
