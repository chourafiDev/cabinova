// Pure billing rules (Module 3): period arithmetic, amounts, labels.
import { moroccoDay, moroccoZone } from '@cabinova/morocco-time';

export type BillingPeriod = 'monthly' | 'annual';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Start + one billing period, clamped to the end of the month:
 * 31 Jan + 1 month = 28/29 Feb, 29 Feb + 1 year = 28 Feb.
 */
/** A confirmed devis: its period starts at midnight the next day in Morocco. */
export const dayAfter = (date: Date) => {
  const start = new Date(`${moroccoDay(date)}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  return start;
};

export function addPeriod(start: Date, period: BillingPeriod) {
  const months = period === 'annual' ? 12 : 1;
  const target = new Date(start);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return target;
}

export const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

/** Price after the subscription's discount, in centimes (rounded). */
export const invoiceAmount = (price: number, discountPercent: number) =>
  Math.round(
    (price * (100 - Math.min(100, Math.max(0, discountPercent)))) / 100,
  );

/** Invoices are due `graceDays` after the later of period start and issue date. */
export const dueDate = (periodStart: Date, issuedAt: Date, graceDays: number) =>
  addDays(periodStart > issuedAt ? periodStart : issuedAt, graceDays);

const day = (d: Date) =>
  new Intl.DateTimeFormat('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: moroccoZone(d),
  }).format(d);

export function invoiceDescription(
  planName: string,
  period: BillingPeriod,
  start: Date,
  end: Date,
  discountPercent: number,
) {
  return `Abonnement ${planName} — ${period === 'annual' ? 'annuel' : 'mensuel'}, du ${day(start)} au ${day(end)}${
    discountPercent ? ` (remise ${discountPercent} %)` : ''
  }`;
}

/** The devis has no dates: the period starts the day after the payment is confirmed. */
export const quoteDescription = (
  planName: string,
  period: BillingPeriod,
  discountPercent: number,
) =>
  `Abonnement ${planName} — ${period === 'annual' ? 'annuel' : 'mensuel'}${
    discountPercent ? ` (remise ${discountPercent} %)` : ''
  }`;

/** "D-2026-000042" */
export const quoteNumber = (year: number, sequence: number) =>
  `D-${year}-${String(sequence).padStart(6, '0')}`;

/** "F-2026-000042" */
export const invoiceNumber = (year: number, sequence: number) =>
  `F-${year}-${String(sequence).padStart(6, '0')}`;

/** The suspension warning goes out this many days before access is cut. */
export const SUSPENSION_WARNING_DAYS = 3;

/**
 * Non-payment for one overdue invoice: suspend once `suspendAfterDays` have
 * passed since its due date, warn (once) in the 3 days before, else wait.
 * 0 days = automatic suspension off.
 */
export function unpaidStep(
  invoice: { dueAt: Date; suspensionWarningSentAt: Date | null },
  suspendAfterDays: number,
  now: Date,
): { action: 'suspend' | 'warn' | 'wait'; suspendOn: Date | null } {
  if (suspendAfterDays <= 0) return { action: 'wait', suspendOn: null };
  const suspendOn = addDays(invoice.dueAt, suspendAfterDays);
  if (suspendOn <= now) return { action: 'suspend', suspendOn };
  const warnFrom = addDays(suspendOn, -SUSPENSION_WARNING_DAYS);
  return {
    action:
      !invoice.suspensionWarningSentAt && warnFrom <= now ? 'warn' : 'wait',
    suspendOn,
  };
}
