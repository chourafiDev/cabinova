import type { TenantStatus } from "./tenants";

// Types of the Module 1 API (apps/admin-api/src/dashboard).

export type DashboardAlert = {
	key: string;
	severity: "critical" | "warning" | "info";
	title: string;
	count: number;
	items: { tenantId: string | null; name: string; detail?: string; href?: string }[];
	href: string;
};

export type Breakdown = { key?: string; label: string; value: number }[];

export type DashboardOverview = {
	generatedAt: string;
	kpis: {
		tenants: {
			total: number;
			byStatus: Partial<Record<TenantStatus, number>>;
			newLast30Days: number;
			/** % vs the previous 30 days; null when there's nothing to compare. */
			newChange: number | null;
		};
		subscriptions: {
			trialing: number;
			active: number;
			pastDue: number;
			trialsEndingIn7Days: number;
			/** Contractual monthly revenue (centimes) — not cash collected. */
			mrr: number;
			trialMrr: number;
		};
		billing: {
			billedThisMonth: number;
			collectedThisMonth: number;
			unpaid: number;
			unpaidCount: number;
			invoiceCount: number;
		};
	};
	series: { month: string; newTenants: number; newSubscriptions: number; cancellations: number }[];
	breakdowns: { plan: Breakdown; city: Breakdown; specialty: Breakdown };
	alerts: DashboardAlert[];
	filters: { cities: string[]; specialties: string[]; plans: { key: string; name: string }[] };
};

/** The filter params the API understands, read from the page URL. */
export const DASHBOARD_FILTERS = ["period", "status", "city", "specialty", "plan"] as const;

/** Creation-period presets → from date (yyyy-mm-dd). */
export const PERIODS: Record<string, { label: string; days?: number; yearStart?: true }> = {
	all: { label: "Toute la période" },
	"30d": { label: "30 derniers jours", days: 30 },
	"90d": { label: "90 derniers jours", days: 90 },
	"12m": { label: "12 derniers mois", days: 365 },
	year: { label: "Cette année", yearStart: true },
};

/** Page search params → API query string. */
export function dashboardQuery(params: Record<string, string | string[] | undefined>) {
	const get = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
	const query = new URLSearchParams();
	const period = PERIODS[get("period") ?? "all"];
	if (period?.days) query.set("from", new Date(Date.now() - period.days * 86_400_000).toISOString().slice(0, 10));
	if (period?.yearStart) query.set("from", `${new Date().getFullYear()}-01-01`);
	for (const key of ["status", "city", "specialty", "plan"]) {
		const value = get(key);
		if (value) query.set(key, value);
	}
	return query;
}
