// Morocco's public holidays ("jours fériés"): the cabinet is closed.
//
// National holidays fall on fixed dates. Religious ones follow the Hijri
// calendar and are confirmed by moon sighting the evening before: they are
// estimated from the Umm al-Qura calendar (Saudi Arabia), one day later, as
// Morocco usually is — and marked `estimated` so the app can say so.

/** [month-day, key, first year observed] */
const FIXED = [
  ['01-01', 'newYear'],
  ['01-11', 'independenceManifesto'],
  ['01-14', 'amazighNewYear', 2024],
  ['05-01', 'labourDay'],
  ['07-30', 'throneDay'],
  ['08-14', 'ouedEdDahab'],
  ['08-20', 'revolutionDay'],
  ['08-21', 'youthDay'],
  ['10-31', 'unityDay', 2025],
  ['11-06', 'greenMarch'],
  ['11-18', 'independenceDay'],
];

/** [Hijri month, day, key]: two days for each Aïd and for the Mawlid. */
const RELIGIOUS = [
  [1, 1, 'islamicNewYear'],
  [3, 12, 'mawlid'],
  [3, 13, 'mawlid'],
  [10, 1, 'eidAlFitr'],
  [10, 2, 'eidAlFitr'],
  [12, 10, 'eidAlAdha'],
  [12, 11, 'eidAlAdha'],
];

/** Morocco usually sees the new moon a day after Saudi Arabia. */
const MOROCCO_OFFSET_DAYS = 1;
const DAY_MS = 86_400_000;

const hijri = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'numeric',
  timeZone: 'UTC',
});

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

const cache = new Map();

/** Every holiday key: the national ones (calendar order), then the religious. */
export const MOROCCO_HOLIDAY_KEYS = [
  ...FIXED.map(([, key]) => key),
  ...new Set(RELIGIOUS.map(([, , key]) => key)),
];

export function moroccoHolidays(year) {
  const cached = cache.get(year);
  if (cached) return cached;
  const list = FIXED.filter(([, , since]) => !since || year >= since).map(
    ([monthDay, key]) => ({ date: `${year}-${monthDay}`, key, estimated: false }),
  );
  // Walk the Saudi calendar over the year (and the days before it the offset pulls in).
  const start = Date.UTC(year, 0, 1) - MOROCCO_OFFSET_DAYS * DAY_MS;
  const end = Date.UTC(year + 1, 0, 1) - MOROCCO_OFFSET_DAYS * DAY_MS;
  for (let t = start; t < end; t += DAY_MS) {
    const parts = hijri.formatToParts(new Date(t + DAY_MS / 2));
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    const match = RELIGIOUS.find(([m, d]) => m === month && d === day);
    if (match) {
      list.push({
        date: iso(t + MOROCCO_OFFSET_DAYS * DAY_MS),
        key: match[2],
        estimated: true,
      });
    }
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  cache.set(year, list);
  return list;
}

export function moroccoHolidayOn(day) {
  return moroccoHolidays(Number(day.slice(0, 4))).find((h) => h.date === day);
}
