import { moroccoHolidayOn, moroccoHolidays } from '@cabinova/morocco-time';
import { describe, expect, it } from 'vitest';

describe('Moroccan public holidays', () => {
  it('has the fixed national days', () => {
    expect(moroccoHolidayOn('2026-07-30')).toMatchObject({
      key: 'throneDay',
      estimated: false,
    });
    expect(moroccoHolidayOn('2026-11-06')?.key).toBe('greenMarch');
    expect(moroccoHolidayOn('2026-11-05')).toBeUndefined();
  });

  it('adds the Amazigh new year from 2024 only', () => {
    expect(moroccoHolidayOn('2023-01-14')).toBeUndefined();
    expect(moroccoHolidayOn('2024-01-14')?.key).toBe('amazighNewYear');
  });

  it('estimates the religious days as Morocco observed them in 2025', () => {
    const religious = moroccoHolidays(2025)
      .filter((h) => h.estimated)
      .map((h) => `${h.date} ${h.key}`);
    expect(religious).toEqual([
      '2025-03-31 eidAlFitr',
      '2025-04-01 eidAlFitr',
      '2025-06-07 eidAlAdha',
      '2025-06-08 eidAlAdha',
      '2025-06-27 islamicNewYear',
      '2025-09-05 mawlid',
      '2025-09-06 mawlid',
    ]);
  });
});
