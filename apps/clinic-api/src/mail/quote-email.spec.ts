import { layout, longDate, money, quoteEmail } from '@cabinova/mail';
import { describe, expect, it } from 'vitest';

const quote = {
  kind: 'request' as const,
  name: 'Dr Benali',
  tenantName: 'Cabinet Atlas',
  number: 'DEV-2026-0001',
  description: 'Offre Pro',
  amount: 59900,
  dueAt: new Date('2026-11-15T12:00:00Z'),
  bank: { accountHolder: 'Cabinova', bankName: 'Banque', rib: '0'.repeat(24) },
  proofEmail: null,
  url: 'https://atlas.cabinova.ma/devis/1',
};

describe('e-mails by language', () => {
  it('stays French by default', () => {
    const { subject, body } = quoteEmail(quote);
    expect(subject).toBe('Devis DEV-2026-0001 — Cabinet Atlas');
    expect(body).toContain('Bonjour Dr Benali');
    expect(body).toContain('Titulaire');
  });

  it('writes Arabic with Western digits', () => {
    const { subject, body } = quoteEmail({ ...quote, locale: 'ar' });
    expect(subject).toBe('عرض السعر DEV-2026-0001 — Cabinet Atlas');
    expect(body).toContain('مرحبًا Dr Benali');
    expect(body).toContain('صاحب الحساب');
    expect(body).not.toContain('Bonjour');
    expect(money(59900, 'ar')).toContain('599');
    expect(longDate(quote.dueAt, 'ar')).toContain('2026');
  });

  it('turns the whole message right to left', () => {
    const brand = {
      name: 'Cabinova',
      color: '#000',
      logoUrl: null,
      footer: null,
    };
    expect(layout('x', brand)).toContain('<html lang="fr" dir="ltr">');
    expect(layout('x', brand, 'ar')).toContain('<html lang="ar" dir="rtl">');
  });

  it('dates in Moroccan time on any runtime', () => {
    // 2026-11-15 23:30 UTC is still the 15th: Morocco is UTC+0 since September.
    expect(longDate(new Date('2026-11-15T23:30:00Z'))).toContain('15');
  });
});
