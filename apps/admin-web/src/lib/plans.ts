import { z } from "zod";
import { FEATURE_LEVELS, type FeatureLevel } from "./features";

export { FEATURE_LEVELS, type FeatureLevel };

// Types, labels and form schema of the Plans API (apps/admin-api/src/plans).
// The feature catalog comes from the API (GET /features), see lib/features.ts.

export type BillingPeriod = "monthly" | "annual";

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
	monthly: "Mensuel",
	annual: "Annuel",
};

export type Plan = {
	id: string;
	key: string;
	name: string;
	description: string | null;
	/** Centimes (MAD). */
	priceMonthly: number;
	priceAnnual: number;
	trialDays: number;
	/** null = unlimited, for every limit. */
	maxDoctors: number | null;
	maxSecretaries: number | null;
	maxUsers: number | null;
	storageQuotaMb: number | null;
	/** Level per feature key; a missing key means "none". */
	features: Record<string, FeatureLevel>;
	active: boolean;
	sortOrder: number;
};

/** GET /plans row: the plan and its number of live subscriptions. */
export type PlanRow = Plan & { tenantCount: number };

/** 29900 → "299 MAD" (centimes shown only when there are some). */
export const formatPrice = (centimes: number) =>
	new Intl.NumberFormat("fr-MA", {
		style: "currency",
		currency: "MAD",
		minimumFractionDigits: centimes % 100 ? 2 : 0,
	}).format(centimes / 100);

export const formatLimit = (value: number | null) => (value === null ? "Illimité" : String(value));

export const formatStorage = (mb: number | null) =>
	mb === null ? "Illimité" : mb >= 1024 ? `${+(mb / 1024).toFixed(1)} Go` : `${mb} Mo`;

/** Annual price vs. twelve monthly payments, e.g. 17 (%). */
export const annualDiscount = (plan: Pick<Plan, "priceMonthly" | "priceAnnual">) =>
	plan.priceMonthly ? Math.round((1 - plan.priceAnnual / (plan.priceMonthly * 12)) * 100) : 0;

const amount = z
	.string()
	.trim()
	.min(1, "Montant requis")
	.refine((v) => /^\d+([.,]\d{1,2})?$/.test(v), "Montant invalide (ex. 299 ou 299,50)");
const limit = z
	.string()
	.trim()
	.refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 0), "Nombre invalide");

export const planSchema = z.object({
	key: z
		.string()
		.trim()
		.toLowerCase()
		.min(2, "Identifiant requis")
		.max(40)
		.regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, "Minuscules, chiffres et _ uniquement"),
	name: z.string().trim().min(2, "Nom requis").max(60),
	description: z.string().trim().max(300),
	priceMonthly: amount,
	priceAnnual: amount,
	trialDays: z
		.string()
		.trim()
		.refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 30, "Entre 0 et 30"),
	maxDoctors: limit,
	maxSecretaries: limit,
	maxUsers: limit,
	/** In Go in the form, Mo in the API. */
	storageQuotaGb: limit,
	sortOrder: limit,
	features: z.record(z.string(), z.enum(Object.keys(FEATURE_LEVELS) as [FeatureLevel, ...FeatureLevel[]])),
	active: z.boolean(),
});
export type PlanInput = z.infer<typeof planSchema>;

const toAmount = (centimes: number) => (centimes / 100).toString().replace(".", ",");
const toCentimes = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const toLimit = (value: string) => (value ? Number(value) : null);

export const EMPTY_PLAN: PlanInput = {
	key: "",
	name: "",
	description: "",
	priceMonthly: "",
	priceAnnual: "",
	trialDays: "7",
	maxDoctors: "",
	maxSecretaries: "",
	maxUsers: "",
	storageQuotaGb: "",
	sortOrder: "0",
	features: {},
	active: true,
};

export const toPlanInput = (plan: Plan): PlanInput => ({
	key: plan.key,
	name: plan.name,
	description: plan.description ?? "",
	priceMonthly: toAmount(plan.priceMonthly),
	priceAnnual: toAmount(plan.priceAnnual),
	trialDays: String(plan.trialDays),
	maxDoctors: plan.maxDoctors?.toString() ?? "",
	maxSecretaries: plan.maxSecretaries?.toString() ?? "",
	maxUsers: plan.maxUsers?.toString() ?? "",
	storageQuotaGb: plan.storageQuotaMb === null ? "" : String(Math.round(plan.storageQuotaMb / 1024)),
	sortOrder: String(plan.sortOrder),
	features: { ...plan.features },
	active: plan.active,
});

/** Form values → API body. `key` only on create, `active` only on edit. */
export const toPlanBody = (values: PlanInput, mode: "create" | "edit") => ({
	...(mode === "create" ? { key: values.key } : { active: values.active }),
	name: values.name,
	description: values.description,
	priceMonthly: toCentimes(values.priceMonthly),
	priceAnnual: toCentimes(values.priceAnnual),
	trialDays: Number(values.trialDays),
	maxDoctors: toLimit(values.maxDoctors),
	maxSecretaries: toLimit(values.maxSecretaries),
	maxUsers: toLimit(values.maxUsers),
	storageQuotaMb: values.storageQuotaGb ? Number(values.storageQuotaGb) * 1024 : null,
	sortOrder: Number(values.sortOrder || 0),
	features: values.features,
});
