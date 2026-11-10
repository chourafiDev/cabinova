import { nextInvoiceAmount } from './amount.js';

describe('nextInvoiceAmount', () => {
  it('applies the commercial discount', () => {
    expect(nextInvoiceAmount(59_900, 10, null)).toBe(53_910);
  });

  it('takes the better of discount and promo, never both', () => {
    expect(
      nextInvoiceAmount(59_900, 10, { discountPercent: 20, invoicesLeft: 2 }),
    ).toBe(47_920);
    expect(
      nextInvoiceAmount(59_900, 30, { discountPercent: 20, invoicesLeft: 2 }),
    ).toBe(41_930);
  });

  it('ignores a promo that has run out; null = no limit', () => {
    expect(
      nextInvoiceAmount(59_900, 0, { discountPercent: 20, invoicesLeft: 0 }),
    ).toBe(59_900);
    expect(
      nextInvoiceAmount(59_900, 0, { discountPercent: 20, invoicesLeft: null }),
    ).toBe(47_920);
  });
});
