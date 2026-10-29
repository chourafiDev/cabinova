import { describe, expect, it } from 'vitest';
import { bucketFor, buckets, daysBetween, today } from './period.js';

describe('period', () => {
  it('counts both ends', () => {
    expect(daysBetween('2026-10-01', '2026-10-30')).toBe(30);
    expect(daysBetween('2026-10-30', '2026-10-30')).toBe(1);
  });

  it('picks days, then weeks, then months', () => {
    expect(bucketFor(30)).toBe('day');
    expect(bucketFor(90)).toBe('week');
    expect(bucketFor(365)).toBe('month');
  });

  it('lists buckets from the Monday or the 1st of the first day', () => {
    // 2026-10-01 is a Thursday.
    expect(buckets('2026-10-01', '2026-10-20', 'week')).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
    expect(buckets('2025-11-15', '2026-02-03', 'month')).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
    expect(buckets('2026-10-30', '2026-11-01', 'day')).toHaveLength(3);
  });

  it('knows the Moroccan day', () => {
    // 23:30 UTC on Oct 31 is already Nov 1 in Morocco (UTC+1).
    expect(today(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
  });
});
