import type { Pool, PoolClient } from '@neondatabase/serverless';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClinicUser } from '../auth/auth.types.js';
import { assertOwner } from '../auth/roles.js';
import { addDays, today } from '../reports/period.js';
import { SpacesService } from '../spaces/spaces.service.js';
import type {
  CashCloseDto,
  CheckoutDto,
  PaymentMethod,
  PaymentsQuery,
  RefundDto,
} from './dto.js';
import { PAYMENT_METHODS } from './dto.js';

const TZ = `'Africa/Casablanca'`;
const TODAY = `(now() at time zone ${TZ})::date`;
/** Net paid on a charge: payments minus refunds, cancelled ones left out. */
const PAID = `coalesce(sum(case when kind = 'payment' then amount else -amount end)
                filter (where cancelled_at is null), 0)::int`;
const PER_PAGE = 50;

/** "R-2026-000042" */
export const receiptNumber = (year: string, sequence: number) =>
  `R-${year}-${String(sequence).padStart(6, '0')}`;

const PAYMENT_COLUMNS = `
  p.id, p.kind, p.method, p.amount, p.reference, p.receipt_number as "receiptNumber",
  p.reason, p.received_at as "receivedAt", rb.name as "receivedBy",
  p.received_by as "receivedById", p.cancelled_at as "cancelledAt",
  p.cancel_reason as "cancelReason", cb.name as "cancelledBy",
  exists (select 1 from cash_closes cc where cc.space_id = p.space_id
           and cc.day = (p.received_at at time zone ${TZ})::date) as locked`;
const PAYMENT_JOINS = `
  left join users rb on rb.id = p.received_by
  left join users cb on cb.id = p.cancelled_by`;

/**
 * Encaissements: a visit's acts and what was paid for them, receipts,
 * cancellations and refunds, and the daily cash close. Everyone records
 * payments in their space; totals and history are the owner's.
 */
@Injectable()
export class PaymentsService {
  constructor(private readonly spaces: SpacesService) {}

  /** A visit's charge (or null), its acts and payments, and the balance. */
  async account(db: Pool | PoolClient, spaceId: string, appointmentId: string) {
    const { rows } = await db.query<{
      id: string;
      starts_at: Date;
      status: string;
      patient: {
        id: string;
        firstName: string;
        lastName: string;
        fileNumber: number;
      };
      practitioner: { id: string; name: string };
      charge_id: string | null;
      total: number | null;
    }>(
      `select a.id, a.starts_at, a.status,
              json_build_object('id', pa.id, 'firstName', pa.first_name,
                'lastName', pa.last_name, 'fileNumber', pa.file_number) as patient,
              json_build_object('id', u.id, 'name', u.name) as practitioner,
              c.id as charge_id, c.total
         from appointments a
         join patients pa on pa.id = a.patient_id
         join users u on u.id = a.practitioner_id
         left join charges c on c.appointment_id = a.id
        where a.id = $1 and a.space_id = $2`,
      [appointmentId, spaceId],
    );
    const visit = rows[0];
    if (!visit)
      throw this.notFound('APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable.');
    const [items, payments] = visit.charge_id
      ? await Promise.all([
          db.query(
            `select id, act_id as "actId", label, unit_price as "unitPrice", quantity
               from charge_items where charge_id = $1 order by position`,
            [visit.charge_id],
          ),
          db.query(
            `select ${PAYMENT_COLUMNS} from payments p ${PAYMENT_JOINS}
              where p.charge_id = $1 order by p.received_at`,
            [visit.charge_id],
          ),
        ])
      : [{ rows: [] }, { rows: [] }];
    const paid = (
      payments.rows as {
        kind: string;
        amount: number;
        cancelledAt: Date | null;
      }[]
    )
      .filter((p) => !p.cancelledAt)
      .reduce((s, p) => s + (p.kind === 'payment' ? p.amount : -p.amount), 0);
    const total = visit.total ?? 0;
    return {
      appointment: {
        id: visit.id,
        startsAt: visit.starts_at,
        status: visit.status,
        patient: visit.patient,
        practitioner: visit.practitioner,
      },
      chargeId: visit.charge_id,
      items: items.rows,
      payments: payments.rows,
      total,
      paid,
      /** Negative: the patient paid more than the acts (to refund). */
      balance: total - paid,
      dayClosed: await this.isClosed(db, spaceId),
    };
  }

  /**
   * Sets the visit's acts (replacing them) and records a payment if given,
   * at most the balance. Returns the account and the new payment's id.
   */
  async checkout(
    db: Pool,
    user: ClinicUser,
    spaceId: string,
    appointmentId: string,
    dto: CheckoutDto,
  ) {
    const paymentId = await this.tx(db, async (client) => {
      const { rows } = await client.query<{
        patient_id: string;
        practitioner_id: string;
        status: string;
      }>(
        `select patient_id, practitioner_id, status from appointments
          where id = $1 and space_id = $2 for update`,
        [appointmentId, spaceId],
      );
      const visit = rows[0];
      if (!visit)
        throw this.notFound(
          'APPOINTMENT_NOT_FOUND',
          'Rendez-vous introuvable.',
        );
      if (visit.status === 'cancelled') {
        throw new ConflictException({
          code: 'APPOINTMENT_CANCELLED',
          message: 'Ce rendez-vous est annulé : rien à encaisser.',
        });
      }
      // An act deleted meanwhile: the line stays, unlinked.
      const { rows: known } = await client.query<{ id: string }>(
        'select id from acts where id = any($1::uuid[])',
        [dto.items.flatMap((i) => (i.actId ? [i.actId] : []))],
      );
      const actIds = new Set(known.map((a) => a.id));
      const total = dto.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

      const { rows: charge } = await client.query<{ id: string }>(
        `insert into charges (space_id, patient_id, appointment_id, practitioner_id, total, created_by)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (appointment_id) do update set total = excluded.total, updated_at = now()
         returning id`,
        [
          spaceId,
          visit.patient_id,
          appointmentId,
          visit.practitioner_id,
          total,
          user.id,
        ],
      );
      const chargeId = charge[0].id;
      await client.query('delete from charge_items where charge_id = $1', [
        chargeId,
      ]);
      await client.query(
        `insert into charge_items (charge_id, act_id, label, unit_price, quantity, position)
         select $1, * from unnest($2::uuid[], $3::text[], $4::int[], $5::int[], $6::int[])`,
        [
          chargeId,
          dto.items.map((i) =>
            i.actId && actIds.has(i.actId) ? i.actId : null,
          ),
          dto.items.map((i) => i.label),
          dto.items.map((i) => i.unitPrice),
          dto.items.map((i) => i.quantity),
          dto.items.map((_, index) => index),
        ],
      );
      if (!dto.payment) return null;

      await this.assertOpen(client, spaceId);
      const balance = total - (await this.paid(client, chargeId));
      if (dto.payment.amount > balance) {
        throw new BadRequestException({
          code: 'OVERPAYMENT',
          message:
            balance > 0
              ? `Le montant dépasse le reste à payer (${mad(balance)}).`
              : 'Cette visite est déjà réglée.',
        });
      }
      const { rows: seq } = await client.query<{ n: string; year: string }>(
        `select nextval('receipt_number_seq') as n,
                to_char(now() at time zone ${TZ}, 'YYYY') as year`,
      );
      const { rows: payment } = await client.query<{ id: string }>(
        `insert into payments (space_id, patient_id, charge_id, kind, method, amount,
                               reference, receipt_number, received_by)
         values ($1, $2, $3, 'payment', $4, $5, $6, $7, $8) returning id`,
        [
          spaceId,
          visit.patient_id,
          chargeId,
          dto.payment.method,
          dto.payment.amount,
          dto.payment.reference ?? null,
          receiptNumber(seq[0].year, Number(seq[0].n)),
          user.id,
        ],
      );
      return payment[0].id;
    });
    return { ...(await this.account(db, spaceId, appointmentId)), paymentId };
  }

  /** A mistake: by whoever recorded it, or the owner, until the day is closed. */
  async cancel(
    db: Pool,
    user: ClinicUser,
    spaceId: string,
    id: string,
    reason: string,
  ) {
    const appointmentId = await this.tx(db, async (client) => {
      const payment = await this.payment(client, spaceId, id);
      if (payment.cancelled_at) {
        throw new ConflictException({
          code: 'ALREADY_CANCELLED',
          message: 'Ce paiement est déjà annulé.',
        });
      }
      if (user.role !== 'owner' && payment.received_by !== user.id) {
        throw new ForbiddenException({
          code: 'NOT_YOURS',
          message:
            'Seul(e) la personne qui l’a saisi ou le médecin responsable peut annuler ce paiement.',
        });
      }
      await this.assertOpen(client, spaceId, payment.day);
      if (
        payment.kind === 'payment' &&
        (await this.paid(client, payment.charge_id)) - payment.amount < 0
      ) {
        throw new ConflictException({
          code: 'REFUNDED',
          message:
            'Ce paiement a déjà été remboursé : annulez d’abord le remboursement.',
        });
      }
      await client.query(
        `update payments set cancelled_at = now(), cancelled_by = $2, cancel_reason = $3
          where id = $1`,
        [id, user.id, reason],
      );
      return payment.appointment_id;
    });
    return this.account(db, spaceId, appointmentId);
  }

  /** Money given back to the patient (the owner only), at most what was paid. */
  async refund(
    db: Pool,
    user: ClinicUser,
    spaceId: string,
    chargeId: string,
    dto: RefundDto,
  ) {
    assertOwner(user);
    const appointmentId = await this.tx(db, async (client) => {
      const { rows } = await client.query<{
        patient_id: string;
        appointment_id: string;
      }>(
        `select patient_id, appointment_id from charges
          where id = $1 and space_id = $2 for update`,
        [chargeId, spaceId],
      );
      if (!rows[0])
        throw this.notFound('CHARGE_NOT_FOUND', 'Visite introuvable.');
      await this.assertOpen(client, spaceId);
      const paid = await this.paid(client, chargeId);
      if (dto.amount > paid) {
        throw new BadRequestException({
          code: 'REFUND_TOO_HIGH',
          message: `Le remboursement dépasse ce qui a été payé (${mad(paid)}).`,
        });
      }
      await client.query(
        `insert into payments (space_id, patient_id, charge_id, kind, method, amount,
                               reference, reason, received_by)
         values ($1, $2, $3, 'refund', $4, $5, $6, $7, $8)`,
        [
          spaceId,
          rows[0].patient_id,
          chargeId,
          dto.method,
          dto.amount,
          dto.reference ?? null,
          dto.reason,
          user.id,
        ],
      );
      return rows[0].appointment_id;
    });
    return this.account(db, spaceId, appointmentId);
  }

  /** Everything a receipt shows, for staff of the payment's space. */
  async receipt(db: Pool, user: ClinicUser, id: string) {
    const spaceIds = (await this.spaces.accessible(db, user)).map((s) => s.id);
    const { rows } = await db.query(
      `select ${PAYMENT_COLUMNS}, p.charge_id as "chargeId",
              json_build_object('name', s.name, 'city', s.city, 'address', s.address,
                'phone', s.phone) as space,
              json_build_object('firstName', pa.first_name, 'lastName', pa.last_name,
                'fileNumber', pa.file_number, 'cin', pa.cin) as patient,
              json_build_object('name', u.name, 'startsAt', a.starts_at) as visit,
              c.total
         from payments p ${PAYMENT_JOINS}
         join spaces s on s.id = p.space_id
         join patients pa on pa.id = p.patient_id
         join charges c on c.id = p.charge_id
         join appointments a on a.id = c.appointment_id
         join users u on u.id = c.practitioner_id
        where p.id = $1 and p.kind = 'payment' and p.space_id = any($2::uuid[])`,
      [id, spaceIds],
    );
    const receipt = rows[0] as Record<string, unknown> | undefined;
    if (!receipt) throw this.notFound('RECEIPT_NOT_FOUND', 'Reçu introuvable.');
    const [items, cabinet] = await Promise.all([
      db.query(
        `select label, unit_price as "unitPrice", quantity from charge_items
          where charge_id = $1 order by position`,
        [receipt.chargeId],
      ),
      db.query(
        `select name, legal_name as "legalName", specialty, address, city, phone, email
           from clinic_settings where id = 1`,
      ),
    ]);
    return { ...receipt, items: items.rows, cabinet: cabinet.rows[0] };
  }

  /** A patient's visits with charges in this space, and what they still owe. */
  async patientAccount(db: Pool, spaceId: string, patientId: string) {
    const { rows } = await db.query<{
      appointmentId: string;
      startsAt: Date;
      practitioner: string;
      total: number;
      paid: number;
      acts: string[];
    }>(
      `select c.appointment_id as "appointmentId", a.starts_at as "startsAt",
              u.name as practitioner, c.total,
              (select ${PAID} from payments where charge_id = c.id) as paid,
              array(select label from charge_items i where i.charge_id = c.id
                     order by position) as acts
         from charges c
         join appointments a on a.id = c.appointment_id
         join users u on u.id = c.practitioner_id
        where c.patient_id = $1 and c.space_id = $2
        order by a.starts_at desc`,
      [patientId, spaceId],
    );
    const visits = rows.map((r) => ({ ...r, balance: r.total - r.paid }));
    return {
      visits,
      /** Still owed (overpaid visits don't offset another visit's debt). */
      balance: visits.reduce((s, v) => s + Math.max(0, v.balance), 0),
    };
  }

  /**
   * The desk's day in a space: today's visits and what each still owes,
   * older unpaid visits, and whether the cash is closed. No totals.
   */
  async desk(db: Pool, spaceId: string) {
    const [visits, unpaid, close] = await Promise.all([
      db.query(
        `select a.id, a.starts_at as "startsAt", a.status,
                json_build_object('id', pa.id, 'firstName', pa.first_name,
                  'lastName', pa.last_name, 'fileNumber', pa.file_number) as patient,
                u.name as practitioner, c.id as "chargeId", c.total,
                (select ${PAID} from payments where charge_id = c.id) as paid
           from appointments a
           join patients pa on pa.id = a.patient_id
           join users u on u.id = a.practitioner_id
           left join charges c on c.appointment_id = a.id
          where a.space_id = $1 and a.status <> 'cancelled'
            and (a.starts_at at time zone ${TZ})::date = ${TODAY}
          order by a.starts_at`,
        [spaceId],
      ),
      db.query(
        `select * from (
           select a.id, a.starts_at as "startsAt",
                  json_build_object('id', pa.id, 'firstName', pa.first_name,
                    'lastName', pa.last_name, 'fileNumber', pa.file_number) as patient,
                  u.name as practitioner, c.total,
                  (select ${PAID} from payments where charge_id = c.id) as paid
             from charges c
             join appointments a on a.id = c.appointment_id
             join patients pa on pa.id = c.patient_id
             join users u on u.id = c.practitioner_id
            where c.space_id = $1 and (a.starts_at at time zone ${TZ})::date < ${TODAY}) v
          where total > paid order by "startsAt" desc limit 100`,
        [spaceId],
      ),
      db.query(
        `select cc.closed_at as "closedAt", u.name as "closedBy"
           from cash_closes cc left join users u on u.id = cc.closed_by
          where cc.space_id = $1 and cc.day = ${TODAY}`,
        [spaceId],
      ),
    ]);
    const withBalance = <T extends { total: number | null; paid: number }>(
      r: T,
    ) => ({
      ...r,
      balance: r.total === null ? null : r.total - r.paid,
    });
    return {
      day: today(),
      closed: close.rows[0] ?? null,
      visits: visits.rows.map(withBalance),
      unpaid: unpaid.rows.map(withBalance),
    };
  }

  /**
   * Closes today's cash in a space. The desk counts the cash blind; only the
   * owner gets the expected amounts and the difference back.
   */
  async close(db: Pool, user: ClinicUser, spaceId: string, dto: CashCloseDto) {
    const close = await this.tx(db, async (client) => {
      // Waits for movements in progress (they hold it shared), then blocks new ones.
      await client.query('select 1 from spaces where id = $1 for update', [
        spaceId,
      ]);
      const { rows: net } = await client.query<{
        method: PaymentMethod;
        net: number;
      }>(
        `select method, ${PAID} as net from payments
          where space_id = $1 and (received_at at time zone ${TZ})::date = ${TODAY}
          group by method`,
        [spaceId],
      );
      const expected = Object.fromEntries(
        PAYMENT_METHODS.map((m) => [
          m,
          net.find((r) => r.method === m)?.net ?? 0,
        ]),
      );
      try {
        const { rows } = await client.query<{ closedAt: Date }>(
          `insert into cash_closes (space_id, day, expected, counted_cash, note, closed_by)
           values ($1, ${TODAY}, $2, $3, $4, $5) returning closed_at as "closedAt"`,
          [
            spaceId,
            JSON.stringify(expected),
            dto.countedCash,
            dto.note ?? null,
            user.id,
          ],
        );
        return { closedAt: rows[0].closedAt, expected };
      } catch (err) {
        if ((err as { code?: string }).code === '23505') throw this.dayClosed();
        throw err;
      }
    });
    return {
      closedAt: close.closedAt,
      ...(user.role === 'owner' && {
        expected: close.expected,
        countedCash: dto.countedCash,
        difference: dto.countedCash - close.expected.cash,
      }),
    };
  }

  /** The owner's history: totals by method, what's still owed, every movement. */
  async history(db: Pool, user: ClinicUser, query: PaymentsQuery) {
    assertOwner(user);
    const { from, to, spaceIds } = await this.scope(db, user, query);
    const params = [from, to, spaceIds, query.method ?? null];
    const where = `p.space_id = any($3::uuid[])
       and ($4::payment_method is null or p.method = $4)
       and p.received_at >= ($1::date::timestamp at time zone ${TZ})
       and p.received_at < (($2::date + 1)::timestamp at time zone ${TZ})`;
    const page = query.page ?? 1;
    const [totals, byMethod, rows, outstanding] = await Promise.all([
      db.query<Record<string, string>>(
        `select
           coalesce(sum(amount) filter (where kind = 'payment' and cancelled_at is null), 0) as received,
           coalesce(sum(amount) filter (where kind = 'refund' and cancelled_at is null), 0) as refunded,
           count(*) filter (where kind = 'payment' and cancelled_at is null) as payments,
           count(*) filter (where cancelled_at is not null) as cancelled,
           count(*) as total
         from payments p where ${where}`,
        params,
      ),
      db.query<{ method: PaymentMethod; net: number }>(
        `select method, ${PAID} as net from payments p where ${where} group by method`,
        params,
      ),
      db.query(
        `select ${PAYMENT_COLUMNS},
                json_build_object('id', pa.id, 'firstName', pa.first_name,
                  'lastName', pa.last_name, 'fileNumber', pa.file_number) as patient,
                s.name as space, u.name as practitioner, c.appointment_id as "appointmentId"
           from payments p ${PAYMENT_JOINS}
           join patients pa on pa.id = p.patient_id
           join spaces s on s.id = p.space_id
           join charges c on c.id = p.charge_id
           join users u on u.id = c.practitioner_id
          where ${where}
          order by p.received_at desc limit ${PER_PAGE} offset ${(page - 1) * PER_PAGE}`,
        params,
      ),
      db.query<{ amount: string; visits: string }>(
        `select coalesce(sum(due), 0) as amount, count(*) as visits from (
           select c.total - (select ${PAID} from payments where charge_id = c.id) as due
             from charges c where c.space_id = any($1::uuid[])) d
          where due > 0`,
        [spaceIds],
      ),
    ]);
    const t = totals.rows[0];
    return {
      period: { from, to },
      totals: {
        received: Number(t.received),
        refunded: Number(t.refunded),
        net: Number(t.received) - Number(t.refunded),
        payments: Number(t.payments),
        cancelled: Number(t.cancelled),
        byMethod: PAYMENT_METHODS.map((method) => ({
          method,
          net: byMethod.rows.find((r) => r.method === method)?.net ?? 0,
        })),
      },
      /** Every visit still owed in these spaces, whenever it was. */
      outstanding: {
        amount: Number(outstanding.rows[0].amount),
        visits: Number(outstanding.rows[0].visits),
      },
      payments: rows.rows,
      page,
      pageCount: Math.max(1, Math.ceil(Number(t.total) / PER_PAGE)),
    };
  }

  /** The owner's view of the closes: expected, counted and the difference. */
  async closes(db: Pool, user: ClinicUser, query: PaymentsQuery) {
    assertOwner(user);
    const { from, to, spaceIds } = await this.scope(db, user, query);
    const { rows } = await db.query<{
      expected: Record<PaymentMethod, number>;
      countedCash: number;
    }>(
      `select cc.id, to_char(cc.day, 'YYYY-MM-DD') as day, s.name as space,
              cc.expected, cc.counted_cash as "countedCash", cc.note,
              u.name as "closedBy", cc.closed_at as "closedAt"
         from cash_closes cc
         join spaces s on s.id = cc.space_id
         left join users u on u.id = cc.closed_by
        where cc.space_id = any($3::uuid[]) and cc.day between $1::date and $2::date
        order by cc.day desc, s.name`,
      [from, to, spaceIds],
    );
    return rows.map((r) => ({
      ...r,
      difference: r.countedCash - r.expected.cash,
    }));
  }

  /** The period (default: the last 30 days) and the spaces asked for. */
  private async scope(db: Pool, user: ClinicUser, query: PaymentsQuery) {
    const to = query.to ?? today();
    const from = query.from ?? addDays(to, -29);
    if (from > to) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'La date de début doit précéder la date de fin.',
      });
    }
    const accessible = await this.spaces.accessible(db, user);
    const spaceIds = accessible
      .filter((s) => !query.space || s.id === query.space)
      .map((s) => s.id);
    if (spaceIds.length === 0)
      throw this.notFound('SPACE_NOT_FOUND', 'Espace introuvable.');
    return { from, to, spaceIds };
  }

  private async payment(client: PoolClient, spaceId: string, id: string) {
    const { rows } = await client.query<{
      kind: string;
      amount: number;
      charge_id: string;
      appointment_id: string;
      received_by: string | null;
      cancelled_at: Date | null;
      day: string;
    }>(
      `select p.kind, p.amount, p.charge_id, c.appointment_id, p.received_by, p.cancelled_at,
              to_char(p.received_at at time zone ${TZ}, 'YYYY-MM-DD') as day
         from payments p join charges c on c.id = p.charge_id
        where p.id = $1 and p.space_id = $2 for update of p`,
      [id, spaceId],
    );
    if (!rows[0])
      throw this.notFound('PAYMENT_NOT_FOUND', 'Paiement introuvable.');
    return rows[0];
  }

  private async paid(db: Pool | PoolClient, chargeId: string) {
    const { rows } = await db.query<{ paid: number }>(
      `select ${PAID} as paid from payments where charge_id = $1`,
      [chargeId],
    );
    return rows[0].paid;
  }

  /** Today (or `day`) is closed in this space. */
  private async isClosed(db: Pool | PoolClient, spaceId: string, day?: string) {
    const { rows } = await db.query(
      `select 1 from cash_closes where space_id = $1 and day = coalesce($2::date, ${TODAY})`,
      [spaceId, day ?? null],
    );
    return rows.length > 0;
  }

  /**
   * The day is still open; holds the space row (shared) so a close can't
   * slip in before this movement commits.
   */
  private async assertOpen(client: PoolClient, spaceId: string, day?: string) {
    await client.query('select 1 from spaces where id = $1 for share', [
      spaceId,
    ]);
    if (await this.isClosed(client, spaceId, day)) throw this.dayClosed();
  }

  private dayClosed() {
    return new ConflictException({
      code: 'DAY_CLOSED',
      message:
        'La caisse de ce jour est clôturée : plus aucun mouvement possible.',
    });
  }

  private notFound(code: string, message: string) {
    return new NotFoundException({ code, message });
  }

  private async tx<T>(db: Pool, fn: (client: PoolClient) => Promise<T>) {
    const client = await db.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }
}

/** 25000 → "250 MAD" (centimes). */
const mad = (centimes: number) =>
  `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(centimes / 100)} MAD`;
