export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
) {
  if (!date) return "";

  try {
    // Always Moroccan time: the same on the server and in the browser.
    return new Intl.DateTimeFormat("fr-MA", {
      timeZone: "Africa/Casablanca",
      month: opts.month ?? "long",
      day: opts.day ?? "numeric",
      year: opts.year ?? "numeric",
      ...opts,
    }).format(new Date(date));
  } catch {
    return "";
  }
}
