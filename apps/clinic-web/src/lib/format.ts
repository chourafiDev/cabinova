// Always Moroccan time: the same on the server and in the browser.
const TIME_ZONE = "Africa/Casablanca";

export function formatDate(date: Date | string | number, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(new Date(date));
}

/** 125000 → "1 250 MAD" (amounts are in centimes, like the platform). */
export function formatMad(centimes: number) {
  return `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(centimes / 100)} MAD`;
}

/** "Fatima Zahra El Idrissi" → "FE" */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .filter((_, i, all) => i === 0 || i === all.length - 1)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
