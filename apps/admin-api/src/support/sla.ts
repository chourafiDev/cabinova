// Support et assistance — how fast the first answer is due. Calendar hours
// (support is reachable every day); cabinets with "Support prioritaire"
// get the shorter column.

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus =
  'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

/** First-response target in hours: [standard, priority support]. */
export const FIRST_RESPONSE_HOURS: Record<TicketPriority, [number, number]> = {
  urgent: [2, 1],
  high: [8, 4],
  normal: [24, 8],
  low: [72, 24],
};

/** Resolved tickets close themselves after this many quiet days. */
export const AUTO_CLOSE_DAYS = 7;

export const ACTIVE_STATUSES: readonly TicketStatus[] = [
  'open',
  'in_progress',
  'waiting',
];

export function firstResponseDue(
  openedAt: Date,
  priority: TicketPriority,
  prioritySupport: boolean,
) {
  const hours = FIRST_RESPONSE_HOURS[priority][prioritySupport ? 1 : 0];
  return new Date(openedAt.getTime() + hours * 3_600_000);
}

/** Past its first-response deadline with no answer yet, and still open. */
export const isOverdue = (
  t: {
    status: TicketStatus;
    firstResponseAt: Date | null;
    firstResponseDueAt: Date;
  },
  now: Date,
) =>
  ACTIVE_STATUSES.includes(t.status) &&
  !t.firstResponseAt &&
  t.firstResponseDueAt < now;
