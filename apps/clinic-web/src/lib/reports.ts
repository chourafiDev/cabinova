// Statistiques (clinic-api GET /reports): types, periods and labels.
import { formatDate } from "./format";

export type Bucket = "day" | "week" | "month";

type Totals = {
	/** Not cancelled. */
	appointments: number;
	completed: number;
	/** Still to come (scheduled, confirmed, in the waiting room…). */
	pending: number;
	noShow: number;
	cancelled: number;
	/** Distinct patients seen. */
	patients: number;
	/** Patients whose first visit ever is in the period. */
	newPatients: number;
	/** No-shows among appointments due (seen + absent), in %. */
	noShowRate: number | null;
	/** Cancelled among every appointment, in %. */
	cancellationRate: number | null;
};

export type SeriesPoint = {
	date: string;
	completed: number;
	pending: number;
	noShow: number;
	cancelled: number;
	newPatients: number;
	returningPatients: number;
};

export type Report = {
	period: { from: string; to: string; days: number; bucket: Bucket; previous: { from: string; to: string } };
	filters: {
		spaces: { id: string; name: string; city: string | null }[];
		space: string | null;
		/** The owner's choice of doctors; null for doctors (cabinet or "mine"). */
		practitioners: { id: string; name: string }[] | null;
		practitioner: string | null;
	};
	activity: {
		totals: Totals;
		previous: Totals;
		/** % change vs the previous period of the same length (null: nothing before). */
		change: { appointments: number | null; completed: number | null; patients: number | null; newPatients: number | null };
		series: SeriesPoint[];
	};
	patients: {
		sex: { male: number; female: number };
		age: { key: string; label: string; count: number }[];
		coverage: { key: string; count: number }[];
	};
	byPractitioner:
		| { id: string; name: string; appointments: number; completed: number; patients: number; noShowRate: number | null }[]
		| null;
	bySpace:
		| {
				id: string;
				name: string;
				city: string | null;
				appointments: number;
				completed: number;
				patients: number;
				newPatients: number;
				noShowRate: number | null;
		  }[]
		| null;
	affluence: {
		/** weekday: 1 = Monday … 7 = Sunday. */
		heatmap: { weekday: number; hour: number; count: number }[];
		leadTimes: { median: number | null; buckets: { key: string; label: string; count: number }[] };
	};
	/** Encaissements (centimes), the owner only. */
	revenue: {
		totals: { net: number; received: number; refunded: number };
		previous: { net: number };
		change: number | null;
		series: { date: string; net: number }[];
		byMethod: { method: "cash" | "card" | "cheque" | "transfer"; net: number }[];
		byPractitioner: { id: string; name: string; net: number }[];
		byAct: { label: string; count: number; amount: number }[];
		/** Still owed for the period's visits. */
		outstanding: { amount: number; visits: number };
	} | null;
};

/** Period presets, the custom range last. */
export const PRESETS = [
	{ key: "7j", label: "7 jours", days: 7 },
	{ key: "30j", label: "30 jours", days: 30 },
	{ key: "90j", label: "3 mois", days: 90 },
	{ key: "12m", label: "12 mois", days: 365 },
] as const;
export type PresetKey = (typeof PRESETS)[number]["key"];
export const DEFAULT_PRESET: PresetKey = "30j";

/**
 * Series colours, validated (dataviz palette checks) in this order on the
 * light and dark surfaces; aqua and yellow are under 3:1 contrast, so every
 * chart has a legend and a table view.
 */
export const SERIES = {
	completed: { label: "Vus", theme: { light: "#724e91", dark: "#724e91" } },
	pending: { label: "À venir", theme: { light: "#00a896", dark: "#00a896" } },
	noShow: { label: "Absents", theme: { light: "#eda100", dark: "#c98500" } },
	cancelled: { label: "Annulés", theme: { light: "#c3c2b7", dark: "#5f5e58" } },
	newPatients: { label: "Nouveaux", theme: { light: "#724e91", dark: "#724e91" } },
	returningPatients: { label: "Déjà suivis", theme: { light: "#00a896", dark: "#00a896" } },
} as const;

/** Single-series magnitude bars and the heatmap ramp. */
export const MAGNITUDE = "#724e91";

const noon = (day: string) => `${day}T12:00:00`;

/** A bucket's short axis label: "8 sept.", "7 sept." (week of) or "sept. 26". */
export function bucketLabel(date: string, bucket: Bucket, locale = "fr-MA") {
	if (bucket === "month") return formatDate(noon(date), { day: undefined, month: "short", year: "2-digit" }, locale);
	return formatDate(noon(date), { month: "short", year: undefined }, locale);
}

/** The same, spelled out for tooltips and tables. */
export function bucketTitle(date: string, bucket: Bucket, locale = "fr-MA") {
	if (bucket === "month") return formatDate(noon(date), { day: undefined, month: "long" }, locale);
	const day = formatDate(noon(date), { weekday: bucket === "day" ? "long" : undefined, month: "long" }, locale);
	if (bucket !== "week") return day;
	return locale.startsWith("ar") ? `أسبوع ${day}` : `Semaine du ${day}`;
}

/** "1 – 30 septembre 2026", "15 août – 13 sept. 2026". */
export function periodLabel(from: string, to: string, locale = "fr-MA") {
	const sameYear = from.slice(0, 4) === to.slice(0, 4);
	const sameMonth = sameYear && from.slice(5, 7) === to.slice(5, 7);
	const start = sameMonth
		? formatDate(noon(from), { month: undefined, year: undefined }, locale)
		: formatDate(noon(from), { month: "short", year: sameYear ? undefined : "numeric" }, locale);
	return `${start} – ${formatDate(noon(to), { month: sameMonth ? "long" : "short" }, locale)}`;
}

export const formatRate = (rate: number | null, locale = "fr-MA") =>
	rate === null ? "—" : `${rate.toLocaleString(locale, { maximumFractionDigits: 1 })} %`;

const MONDAY = Date.UTC(2024, 0, 1);

/** Monday → Sunday. */
export const weekdays = (locale: string, width: "short" | "long") =>
	Array.from({ length: 7 }, (_, i) =>
		new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(MONDAY + i * 86_400_000),
	).map((day) => day.replace(".", ""));
