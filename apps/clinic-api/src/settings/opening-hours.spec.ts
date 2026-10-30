import { describe, expect, it } from 'vitest';
import { isWithinOpeningHours, parseOpeningHours } from './opening-hours.js';

const closed = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
const message = (value: unknown) => {
  try {
    parseOpeningHours(value);
  } catch (err) {
    return (err as { response: { message: string } }).response.message;
  }
  throw new Error('accepted');
};

describe('parseOpeningHours', () => {
  it('sorts the periods, fills missing days and drops unknown keys', () => {
    expect(
      parseOpeningHours({
        1: [
          { from: '15:00', to: '19:00', extra: true },
          { from: '09:00', to: '13:00' },
        ],
        holidays: [],
      }),
    ).toEqual({
      ...closed,
      1: [
        { from: '09:00', to: '13:00' },
        { from: '15:00', to: '19:00' },
      ],
    });
  });

  it('accepts back-to-back periods', () => {
    expect(
      parseOpeningHours({
        2: [
          { from: '08:00', to: '12:00' },
          { from: '12:00', to: '14:00' },
        ],
      })[2],
    ).toHaveLength(2);
  });

  it('rejects bad times, empty or reversed periods and overlaps', () => {
    expect(message([])).toBe('Horaires invalides.');
    expect(message({ 1: [{ from: '9:00', to: '12:00' }] })).toBe(
      'Heure invalide (format HH:MM).',
    );
    expect(message({ 1: [{ from: '24:00', to: '12:00' }] })).toBe(
      'Heure invalide (format HH:MM).',
    );
    expect(message({ 1: [{ from: '12:00', to: '12:00' }] })).toBe(
      'Chaque plage doit finir après son début.',
    );
    expect(
      message({
        1: [
          { from: '08:00', to: '13:00' },
          { from: '12:30', to: '18:00' },
        ],
      }),
    ).toBe('Les plages horaires d’un même jour se chevauchent.');
    expect(message({ 1: Array(4).fill({ from: '08:00', to: '09:00' }) })).toBe(
      'Au plus 3 plages horaires par jour.',
    );
  });
});

describe('isWithinOpeningHours', () => {
  const hours = parseOpeningHours({
    1: [
      { from: '08:00', to: '12:00' },
      { from: '12:00', to: '13:00' },
      { from: '15:00', to: '18:00' },
    ],
  });
  // Monday 2 November 2026; Morocco is UTC+1.
  const at = (time: string) => new Date(`2026-11-02T${time}:00+01:00`);
  const within = (from: string, to: string) =>
    isWithinOpeningHours(at(from), at(to), hours);

  it('uses the cabinet clock, whatever the server time zone', () => {
    expect(within('08:00', '08:30')).toBe(true);
    expect(within('07:30', '08:00')).toBe(false);
    expect(within('17:30', '18:00')).toBe(true);
  });

  it('refuses a slot that runs past closing or across a gap', () => {
    expect(within('17:45', '18:15')).toBe(false);
    expect(within('12:30', '15:30')).toBe(false);
    expect(within('13:00', '13:30')).toBe(false);
  });

  it('treats back-to-back periods as one', () => {
    expect(within('11:30', '12:30')).toBe(true);
  });

  it('refuses a closed day', () => {
    const sunday = new Date('2026-11-01T10:00:00+01:00');
    expect(
      isWithinOpeningHours(
        sunday,
        new Date(sunday.getTime() + 1_800_000),
        hours,
      ),
    ).toBe(false);
  });
});
