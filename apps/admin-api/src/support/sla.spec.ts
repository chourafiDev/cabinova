import { describe, expect, it } from 'vitest';
import { firstResponseDue, isOverdue } from './sla.js';

const at = new Date('2026-10-24T10:00:00Z');

describe('firstResponseDue', () => {
  it('uses the standard target', () => {
    expect(firstResponseDue(at, 'normal', false).toISOString()).toBe(
      '2026-10-25T10:00:00.000Z',
    );
    expect(firstResponseDue(at, 'urgent', false).toISOString()).toBe(
      '2026-10-24T12:00:00.000Z',
    );
  });

  it('is shorter with priority support', () => {
    expect(firstResponseDue(at, 'normal', true).toISOString()).toBe(
      '2026-10-24T18:00:00.000Z',
    );
    expect(firstResponseDue(at, 'urgent', true).toISOString()).toBe(
      '2026-10-24T11:00:00.000Z',
    );
  });
});

describe('isOverdue', () => {
  const due = new Date('2026-10-24T12:00:00Z');
  const later = new Date('2026-10-24T13:00:00Z');

  it('flags an unanswered open ticket past its deadline', () => {
    expect(
      isOverdue(
        { status: 'open', firstResponseAt: null, firstResponseDueAt: due },
        later,
      ),
    ).toBe(true);
  });

  it('ignores answered, resolved or not-yet-due tickets', () => {
    expect(
      isOverdue(
        { status: 'open', firstResponseAt: at, firstResponseDueAt: due },
        later,
      ),
    ).toBe(false);
    expect(
      isOverdue(
        { status: 'resolved', firstResponseAt: null, firstResponseDueAt: due },
        later,
      ),
    ).toBe(false);
    expect(
      isOverdue(
        { status: 'open', firstResponseAt: null, firstResponseDueAt: due },
        at,
      ),
    ).toBe(false);
  });
});
