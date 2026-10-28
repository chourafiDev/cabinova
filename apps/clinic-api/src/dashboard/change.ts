/** % change from `previous` to `current`, rounded; null when there's nothing to compare. */
export const percentChange = (current: number, previous: number) =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
