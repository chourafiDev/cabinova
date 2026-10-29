// Calendar arithmetic on "YYYY-MM-DD" days (no time zone involved: the days
// are already Moroccan ones).

export type Bucket = 'day' | 'week' | 'month';

/** Longest period shown at once. */
export const MAX_DAYS = 366;

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (date: Date) => date.toISOString().slice(0, 10);

export const addDays = (day: string, n: number) =>
  toDay(new Date(toDate(day).getTime() + n * 86_400_000));

/** Days from `from` to `to`, both included. */
export const daysBetween = (from: string, to: string) =>
  Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000) + 1;

/** Today in Morocco. */
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(
    now,
  );

/** Days up to ~6 weeks, then weeks up to ~6 months, then months. */
export const bucketFor = (days: number): Bucket =>
  days <= 45 ? 'day' : days <= 190 ? 'week' : 'month';

/** The bucket a day falls in: itself, its week's Monday, or its month's 1st. */
export function bucketStart(day: string, bucket: Bucket) {
  if (bucket === 'day') return day;
  if (bucket === 'month') return `${day.slice(0, 7)}-01`;
  const weekday = toDate(day).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** Every bucket of the period, in order (keys as Postgres date_trunc gives them). */
export function buckets(from: string, to: string, bucket: Bucket) {
  const keys: string[] = [];
  let key = bucketStart(from, bucket);
  while (key <= to) {
    keys.push(key);
    if (bucket === 'day') key = addDays(key, 1);
    else if (bucket === 'week') key = addDays(key, 7);
    else {
      const d = toDate(key);
      d.setUTCMonth(d.getUTCMonth() + 1);
      key = toDay(d);
    }
  }
  return keys;
}
