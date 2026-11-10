// Who sees which ticket. With "support:all" (Super Admin by default):
// every ticket. Without it (Agent de Support): the tickets assigned to them
// and the unassigned ones — never a colleague's.

export type TicketViewer = { id: string; all: boolean };

export const canSeeTicket = (
  ticket: { assigneeId: string | null },
  viewer: TicketViewer,
) => viewer.all || !ticket.assigneeId || ticket.assigneeId === viewer.id;
