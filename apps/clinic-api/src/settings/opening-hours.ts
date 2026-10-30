import { BadRequestException } from '@nestjs/common';
import type { OpeningHours } from '@cabinova/tenant-db/schema';

export type { OpeningHours };

export const DAYS = ['0', '1', '2', '3', '4', '5', '6'] as const;
/** At most a morning, an afternoon and an evening. */
const MAX_PERIODS = 3;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const invalid = (message: string) =>
  new BadRequestException({ code: 'INVALID_OPENING_HOURS', message });

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Casablanca',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const toMinutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

/** Weekday and minutes since midnight, on the cabinet's clock. */
function local(date: Date) {
  const part = (type: string) =>
    clock.formatToParts(date).find((p) => p.type === type)!.value;
  return {
    day: String(WEEKDAY.indexOf(part('weekday'))) as keyof OpeningHours,
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

/** The whole slot is open; back-to-back periods count as one. */
export function isWithinOpeningHours(
  startsAt: Date,
  endsAt: Date,
  hours: OpeningHours,
) {
  const { day, minutes } = local(startsAt);
  const end = minutes + (endsAt.getTime() - startsAt.getTime()) / 60_000;
  let reached = minutes;
  for (const period of hours[day] ?? []) {
    if (toMinutes(period.from) <= reached && toMinutes(period.to) > reached) {
      reached = toMinutes(period.to);
    }
  }
  return reached >= end;
}

/**
 * Checks a week of opening hours from the client and returns it in its
 * stored form: every day present, periods sorted, nothing else kept.
 */
export function parseOpeningHours(value: unknown): OpeningHours {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid('Horaires invalides.');
  }
  const week = value as Record<string, unknown>;
  const result = {} as OpeningHours;
  for (const day of DAYS) {
    const periods = week[day] ?? [];
    if (!Array.isArray(periods) || periods.length > MAX_PERIODS) {
      throw invalid(`Au plus ${MAX_PERIODS} plages horaires par jour.`);
    }
    const parsed = periods.map((p: unknown) => {
      const { from, to } = (p ?? {}) as { from?: unknown; to?: unknown };
      if (
        typeof from !== 'string' ||
        typeof to !== 'string' ||
        !TIME.test(from) ||
        !TIME.test(to)
      ) {
        throw invalid('Heure invalide (format HH:MM).');
      }
      if (from >= to) {
        throw invalid('Chaque plage doit finir après son début.');
      }
      return { from, to };
    });
    parsed.sort((a, b) => a.from.localeCompare(b.from));
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i].from < parsed[i - 1].to) {
        throw invalid('Les plages horaires d’un même jour se chevauchent.');
      }
    }
    result[day] = parsed;
  }
  return result;
}
