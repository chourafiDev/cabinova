import type { TenantStatus } from "./tenants";

// Types and labels of the features API (apps/admin-api/src/features).
// FEATURE_LEVELS mirrors apps/admin-api/src/plans/catalog.ts.

export const FEATURE_LEVELS = {
	included: "Inclus",
	limited: "Limité",
	addon: "En option",
	custom: "Personnalisé",
	none: "Non inclus",
} as const;
export type FeatureLevel = keyof typeof FEATURE_LEVELS;

export type FeatureStatus = "active" | "beta" | "disabled";

export const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
	active: "Active",
	beta: "Bêta",
	disabled: "Désactivée",
};

export const FEATURE_STATUS_TONES: Record<FeatureStatus, string> = {
	active: "bg-emerald-50 text-emerald-700",
	beta: "bg-violet-50 text-violet-700",
	disabled: "bg-red-50 text-red-700",
};

/** Why a cabinet has (or hasn't) a feature — see resolve.ts in the API. */
export const SOURCE_LABELS = {
	plan: "Selon l’offre",
	override: "Exception",
	beta: "Bêta (non testeur)",
	kill_switch: "Désactivée partout",
} as const;
export type FeatureSource = keyof typeof SOURCE_LABELS;

export type Feature = {
	key: string;
	name: string;
	description: string | null;
	category: string | null;
	status: FeatureStatus;
	disabledReason: string | null;
	sortOrder: number;
};

/** GET /features row. */
export type FeatureRow = Feature & {
	plans: { key: string; name: string; level: FeatureLevel }[];
	cabinetsReached: number;
	cabinetsTotal: number;
	overrides: number;
	activeOverrides: number;
};

export type FeatureOverride = {
	id: string;
	tenantId: string;
	tenantName: string;
	tenantStatus: TenantStatus;
	level: FeatureLevel;
	startsAt: string | null;
	endsAt: string | null;
	note: string | null;
	active: boolean;
};

export type FeatureDetail = Feature & { overrides: FeatureOverride[] };

/** GET /tenants/:id/features */
export type TenantFeatures = {
	plan: string | null;
	features: {
		key: string;
		name: string;
		category: string | null;
		status: FeatureStatus;
		disabledReason: string | null;
		planLevel: FeatureLevel | null;
		override: {
			id: string;
			level: FeatureLevel;
			startsAt: string | null;
			endsAt: string | null;
			note: string | null;
			active: boolean;
		} | null;
		effective: { level: FeatureLevel; enabled: boolean; source: FeatureSource };
	}[];
};
