import { type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** Searches shorter than this return nothing (too broad to be useful). */
export const MIN_QUERY_LENGTH = 2;

/** LIKE wildcards typed by the user are matched literally. */
export const escapeLike = (term: string) => term.replace(/[\\%_]/g, '\\$&');

/** Collapses spaces; null when too short to search. */
export function normalizeQuery(raw: string | undefined) {
  const term = (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 100);
  return term.length >= MIN_QUERY_LENGTH ? term : null;
}

/**
 * Case- and accent-insensitive "contains" on any of the columns:
 * "fes" finds "Fès", "medecine" finds "Médecine" (unaccent, drizzle/0013).
 */
export function matchesAny(term: string, columns: (AnyPgColumn | SQL)[]) {
  const pattern = `%${escapeLike(term)}%`;
  // Parenthesised: combined with and(), an open "a or b" would let every
  // column after the first escape the other conditions (ticket visibility).
  return sql`(${sql.join(
    columns.map(
      (column) => sql`unaccent(${column}) ilike unaccent(${pattern})`,
    ),
    sql` or `,
  )})`;
}
