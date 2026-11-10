import { describe, expect, it } from 'vitest';
import { canSeeTicket } from './visibility.js';

const agent = { id: 'agent-a', all: false };
const admin = { id: 'admin', all: true };

describe('canSeeTicket', () => {
  it('lets an agent see their own and unassigned tickets', () => {
    expect(canSeeTicket({ assigneeId: 'agent-a' }, agent)).toBe(true);
    expect(canSeeTicket({ assigneeId: null }, agent)).toBe(true);
  });

  it('hides a colleague’s ticket from an agent', () => {
    expect(canSeeTicket({ assigneeId: 'agent-b' }, agent)).toBe(false);
  });

  it('shows everything with support:all', () => {
    expect(canSeeTicket({ assigneeId: 'agent-b' }, admin)).toBe(true);
  });
});
