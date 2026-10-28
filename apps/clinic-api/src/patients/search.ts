/** LIKE wildcards typed by the user are matched literally. */
export const escapeLike = (term: string) => term.replace(/[\\%_]/g, '\\$&');

/**
 * Builds the WHERE clause of the patients search: name (accents ignored),
 * CIN, phone digits, or the exact file number. Placeholders start at
 * `from` ($from, $from+1…); `alias` prefixes the columns ("p." for
 * "patients p"). Returns the SQL and its values.
 */
export function patientSearch(raw: string, from: number, alias = '') {
  const c = (column: string) => `${alias}${column}`;
  const term = raw.trim().replace(/\s+/g, ' ');
  if (!term) return null;
  const values: unknown[] = [];
  const param = (value: unknown) => {
    values.push(value);
    return `$${from + values.length - 1}`;
  };
  const like = param(`%${escapeLike(term)}%`);
  const conditions = [
    `unaccent(${c('first_name')} || ' ' || ${c('last_name')}) ilike unaccent(${like})`,
    `unaccent(${c('last_name')} || ' ' || ${c('first_name')}) ilike unaccent(${like})`,
  ];
  // A short number is a file number ("2"), not "any CIN containing a 2".
  if (!/^\d+$/.test(term) || term.length >= 4) {
    conditions.push(`${c('cin')} ilike ${like}`);
  }
  const digits = term.replace(/\D/g, '');
  if (digits.length >= 4) {
    conditions.push(`${c('phone')} like ${param(`%${digits}%`)}`);
  }
  if (/^\d{1,9}$/.test(term)) {
    conditions.push(`${c('file_number')} = ${param(Number(term))}`);
  }
  return { sql: `(${conditions.join(' or ')})`, values };
}
