import { moroccoDay, moroccoZone } from "@cabinova/morocco-time";
import type { Appointment } from "./appointments";
import type { Bucket } from "./reports";

/** GET /dashboard (clinic-api): one space, or every space for the owner (?scope=all), over ?from&to. */
export type DashboardData = {
	scope: "space" | "all";
	/** Today, in Moroccan time ("2026-10-28"). */
	date: string;
	period: { from: string; to: string; days: number; bucket: Bucket; previous: { from: string; to: string } };
	kpis: {
		/** The period's appointments, cancellations left out. */
		appointments: number;
		/** Of those, still to come. */
		pending: number;
		seen: number;
		/** % vs the previous period of the same length; null = nothing to compare. */
		seenChange: number | null;
		newPatients: number;
		newPatientsChange: number | null;
		/** Still to come today, whatever the period (welcome line). */
		upcomingToday: number;
	};
	/** The period's finished visits still to check out; money (centimes) for the owner only. */
	cashier: { toCollect: number; received: number | null; receivedChange: number | null };
	/** Booked vs done, per day, week or month of the period. */
	series: { date: string; appointments: number; consultations: number }[];
	/** Today's appointments (one space only). */
	appointments: (Appointment & { firstVisit: boolean })[] | null;
	/** A line per space (every-space view only); waiting is right now. */
	bySpace:
		| { id: string; name: string; city: string | null; appointments: number; waiting: number; seen: number; newPatients: number }[]
		| null;
};

/** The dashboard's period presets; a custom range comes after them. */
export const DASHBOARD_PRESETS = [
	{ key: "7j", days: 7 },
	{ key: "30j", days: 30 },
	{ key: "90j", days: 90 },
	{ key: "1a", days: 365 },
] as const;
export type DashboardPreset = (typeof DASHBOARD_PRESETS)[number]["key"];
export const DEFAULT_DASHBOARD_PRESET: DashboardPreset = "7j";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (day: string, n: number) =>
	new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const span = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;

/** The period from the URL: ?periode= (default 7 days to today) or ?du=&au= (a year at most). */
export function dashboardPeriod(params: Record<string, string | string[] | undefined>) {
	const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
	const from = one(params.du);
	const to = one(params.au);
	if (from && to && DAY.test(from) && DAY.test(to) && span(from, to) >= 1 && span(from, to) <= 366) {
		return { preset: null, from, to };
	}
	const preset =
		DASHBOARD_PRESETS.find((p) => p.key === one(params.periode)) ??
		DASHBOARD_PRESETS.find((p) => p.key === DEFAULT_DASHBOARD_PRESET)!;
	const end = moroccoDay();
	return { preset: preset.key as DashboardPreset, from: addDays(end, 1 - preset.days), to: end };
}

/** "09:30", Moroccan time. */
export const clock = (iso: string, locale = "fr-MA") =>
	new Intl.DateTimeFormat(locale, { timeZone: moroccoZone(iso), hour: "2-digit", minute: "2-digit" }).format(
		new Date(iso),
	);
