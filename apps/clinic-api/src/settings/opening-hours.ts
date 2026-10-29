import { BadRequestException } from '@nestjs/common';
import type { OpeningHours } from '@cabinova/tenant-db/schema';

export type { OpeningHours };

export const DAYS = ['0', '1', '2', '3', '4', '5', '6'] as const;
/** At most a morning, an afternoon and an evening. */
const MAX_PERIODS = 3;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const invalid = (message: string) =>
  new BadRequestException({ code: 'INVALID_OPENING_HOURS', message });

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
