import { moroccoZone } from "@cabinova/morocco-time";

// Always Moroccan time: the same on the server and in the browser.
export function formatDate(date: Date | string | number, opts: Intl.DateTimeFormatOptions = {}, locale = "fr-MA") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: moroccoZone(date),
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(new Date(date));
}

/** 125000 → "1 250 MAD" (amounts are in centimes, like the platform). */
export function formatMad(centimes: number, locale = "fr-MA") {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(centimes / 100)} MAD`;
}

/** "Fatima Zahra El Idrissi" → "FE" */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    // "Dr. Hind Ouakrim" → "HO": a title isn't part of the name.
    .filter((part, i) => i > 0 || !/^(dr|pr)\.?$/i.test(part))
    .filter((_, i, all) => i === 0 || i === all.length - 1)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
