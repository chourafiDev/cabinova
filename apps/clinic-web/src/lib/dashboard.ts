import type { Appointment } from "./appointments";

/** GET /dashboard (clinic-api): one space, or every space for the owner (?scope=all). */
export type DashboardData = {
	scope: "space" | "all";
	/** Today, in Moroccan time ("2026-10-28"). */
	date: string;
	kpis: {
		appointmentsToday: number;
		upcomingToday: number;
		seenToday: number;
		/** % vs the same weekday last week; null = nothing to compare. */
		seenChange: number | null;
		newPatientsMonth: number;
		newPatientsChange: number | null;
	};
	/** Monday → Saturday of the current week. */
	/** Encaissements today (centimes): visits still to check out; money for the owner only. */
	cashier: { toCollect: number; received: number | null; receivedChange: number | null };
	week: { date: string; appointments: number; consultations: number }[];
	/** Today's appointments (one space only). */
	appointments: (Appointment & { firstVisit: boolean })[] | null;
	/** A line per space (every-space view only). */
	bySpace:
		| { id: string; name: string; city: string | null; appointmentsToday: number; waiting: number; seenToday: number; newPatientsMonth: number }[]
		| null;
};

/** "09:30", Moroccan time. */
export const clock = (iso: string) =>
	new Intl.DateTimeFormat("fr-MA", { timeZone: "Africa/Casablanca", hour: "2-digit", minute: "2-digit" }).format(
		new Date(iso),
	);
