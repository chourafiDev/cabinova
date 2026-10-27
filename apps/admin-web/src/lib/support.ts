// Support et assistance — labels and types shared by the inbox, the ticket
// page and the cabinet's Support tab. Keep in sync with
// apps/admin-api/src/support.

export type TicketType = "assistance" | "incident" | "configuration" | "billing";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketChannel = "phone" | "email" | "clinic_app" | "internal";
export type TicketView = "active" | "mine" | "unassigned" | "overdue" | "waiting" | "done" | "all";

export const TYPE_LABELS: Record<TicketType, string> = {
	assistance: "Assistance",
	incident: "Incident",
	configuration: "Configuration",
	billing: "Facturation",
};
export const TYPE_HINTS: Record<TicketType, string> = {
	assistance: "Une question, un blocage d’utilisation",
	incident: "Quelque chose ne fonctionne plus",
	configuration: "Un réglage à faire pour le cabinet",
	billing: "Facture, paiement, abonnement",
};
export const PRIORITY_LABELS: Record<TicketPriority, string> = {
	urgent: "Urgente",
	high: "Haute",
	normal: "Normale",
	low: "Basse",
};
export const STATUS_LABELS: Record<TicketStatus, string> = {
	open: "Ouvert",
	in_progress: "En cours",
	waiting: "En attente du cabinet",
	resolved: "Résolu",
	closed: "Clôturé",
};
export const CHANNEL_LABELS: Record<TicketChannel, string> = {
	phone: "Téléphone",
	email: "E-mail",
	clinic_app: "Application",
	internal: "Interne",
};
export const VIEW_LABELS: Record<TicketView, string> = {
	active: "À traiter",
	mine: "Les miens",
	unassigned: "Non assignés",
	overdue: "Hors délai",
	waiting: "En attente",
	done: "Résolus",
	all: "Tous",
};

/** First-answer targets in hours [standard, support prioritaire] — same as the API. */
export const FIRST_RESPONSE_HOURS: Record<TicketPriority, [number, number]> = {
	urgent: [2, 1],
	high: [8, 4],
	normal: [24, 8],
	low: [72, 24],
};

export type TicketRow = {
	id: string;
	number: string;
	subject: string;
	type: TicketType;
	priority: TicketPriority;
	status: TicketStatus;
	channel: TicketChannel;
	requesterName: string | null;
	requesterEmail: string | null;
	prioritySupport: boolean;
	firstResponseDueAt: string;
	firstResponseAt: string | null;
	resolvedAt: string | null;
	closedAt: string | null;
	lastActivityAt: string;
	createdAt: string;
	overdue: boolean;
	tenant: { id: string; name: string } | null;
	assignee: { id: string; name: string } | null;
	messageCount: number;
};

export type TicketPage = { data: TicketRow[]; total: number; pageCount: number };

export type SupportSummary = Record<"active" | "mine" | "unassigned" | "overdue" | "waiting", number> & {
	openIncidents: number;
	resolved7d: number;
};

export type TicketMessage = {
	id: string;
	kind: "reply" | "clinic" | "note" | "event";
	authorName: string | null;
	body: string;
	emailedTo: string | null;
	createdAt: string;
};

export type TicketDetail = Omit<TicketRow, "tenant" | "messageCount"> & {
	cabinet: {
		id: string;
		name: string;
		status: string;
		responsibleName: string;
		email: string;
		phone: string | null;
		city: string | null;
		plan: string | null;
		prioritySupport: boolean;
	} | null;
	messages: TicketMessage[];
	otherTickets: { id: string; number: string; subject: string; status: TicketStatus; createdAt: string }[];
};

export type SupportAgent = { id: string; name: string };

/** A cabinet as the new-ticket form needs it. */
export type CabinetOption = { id: string; name: string; responsibleName: string; email: string; city: string | null };
