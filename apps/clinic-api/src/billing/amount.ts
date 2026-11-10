/**
 * What the next invoice asks, before credit notes: the better of the
 * commercial discount and a running promo code — the rule admin-api's
 * invoicing applies (billing/periods.ts invoiceAmount).
 */
export function nextInvoiceAmount(
  price: number,
  discountPercent: number,
  promo: { discountPercent: number; invoicesLeft: number | null } | null,
) {
  const promoRuns = promo !== null && (promo.invoicesLeft ?? 1) > 0;
  const percent = Math.max(
    discountPercent,
    promoRuns ? promo.discountPercent : 0,
  );
  return Math.round(
    (price * (100 - Math.min(100, Math.max(0, percent)))) / 100,
  );
}
