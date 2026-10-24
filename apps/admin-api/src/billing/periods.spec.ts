import { addPeriod, dueDate, invoiceAmount, invoiceNumber } from './periods.js';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe('billing periods', () => {
  it('adds a month, clamping to the end of shorter months', () => {
    expect(iso(addPeriod(d('2026-01-15'), 'monthly'))).toBe('2026-02-15');
    expect(iso(addPeriod(d('2026-01-31'), 'monthly'))).toBe('2026-02-28');
    expect(iso(addPeriod(d('2028-01-31'), 'monthly'))).toBe('2028-02-29');
    expect(iso(addPeriod(d('2026-12-10'), 'monthly'))).toBe('2027-01-10');
  });

  it('adds a year, 29 Feb landing on 28 Feb', () => {
    expect(iso(addPeriod(d('2026-03-01'), 'annual'))).toBe('2027-03-01');
    expect(iso(addPeriod(d('2028-02-29'), 'annual'))).toBe('2029-02-28');
  });

  it('applies the discount and rounds to the centime', () => {
    expect(invoiceAmount(59_900, 0)).toBe(59_900);
    expect(invoiceAmount(59_900, 15)).toBe(50_915);
    expect(invoiceAmount(59_900, 100)).toBe(0);
    expect(invoiceAmount(59_900, 150)).toBe(0);
  });

  it('is due grace days after the later of period start and issue date', () => {
    expect(iso(dueDate(d('2026-11-01'), d('2026-10-25'), 7))).toBe(
      '2026-11-08',
    );
    expect(iso(dueDate(d('2026-10-01'), d('2026-10-25'), 7))).toBe(
      '2026-11-01',
    );
  });

  it('numbers invoices per year with 6 digits', () => {
    expect(invoiceNumber(2026, 42)).toBe('F-2026-000042');
  });
});
