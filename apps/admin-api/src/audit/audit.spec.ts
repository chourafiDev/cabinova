import { diff } from './audit.js';

describe('audit diff', () => {
  const current = {
    name: 'Pro',
    maxUsers: 4 as number | null,
    features: { sms_reminders: 'limited' },
  };

  it('keeps only fields that were sent and changed', () => {
    expect(
      diff(current, { name: 'Pro', maxUsers: null }, ['name', 'maxUsers']),
    ).toEqual({ maxUsers: { from: 4, to: null } });
  });

  it('compares JSON values by content', () => {
    expect(
      diff(current, { features: { sms_reminders: 'limited' } }, ['features']),
    ).toEqual({});
    expect(
      diff(current, { features: { sms_reminders: 'included' } }, ['features']),
    ).toHaveProperty('features.to', { sms_reminders: 'included' });
  });

  it('ignores key order in JSON values', () => {
    const stored = { features: { b: 'none', a: 'included' } };
    expect(
      diff(stored, { features: { a: 'included', b: 'none' } }, ['features']),
    ).toEqual({});
  });

  it('ignores keys outside the allow-list', () => {
    expect(diff(current, { name: 'Max' }, ['maxUsers'])).toEqual({});
  });
});
