// Morocco moved to permanent UTC+0 on 2026-09-20 at 01:00 UTC (tzdata 2026c).
// Node and browsers with older data still answer UTC+1 for
// Africa/Casablanca, so from then on we ask for UTC, which every runtime gets
// right. Earlier dates keep the zone: old and new data agree on them.
const PERMANENT_UTC = Date.UTC(2026, 8, 20, 1);

export const moroccoZone = (date) =>
  new Date(date).getTime() >= PERMANENT_UTC ? 'UTC' : 'Africa/Casablanca';

export const moroccoDay = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: moroccoZone(date) }).format(new Date(date));

export {
  MOROCCO_HOLIDAY_KEYS,
  moroccoHolidayOn,
  moroccoHolidays,
} from './holidays.js';
