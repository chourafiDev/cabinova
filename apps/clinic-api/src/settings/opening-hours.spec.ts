import { describe, expect, it } from 'vitest';
import { parseOpeningHours } from './opening-hours.js';

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
