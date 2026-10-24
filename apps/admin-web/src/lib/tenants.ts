import { z } from "zod";
import type { FeatureLevel } from "./features";
import type { BillingPeriod } from "./plans";

// Types, labels and form schemas of the Tenants API (apps/admin-api/src/tenants).

export const TENANT_STATUSES = [
	"pending",
	"provisioning",
	"active",
	"suspended",
	"closure_pending",
	"closed",
] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const STATUS_LABELS: Record<TenantStatus, string> = {
	pending: "En attente",
	provisioning: "Provisionnement",
	active: "Actif",
	suspended: "Suspendu",
	closure_pending: "Fermeture en cours",
	closed: "Fermé",
};

export type TenantRow = {
	id: string;
	name: string;
	responsibleName: string;
	specialty: string | null;
	city: string | null;
	email: string;
	status: TenantStatus;
	trialEndsAt: string | null;
	createdAt: string;
	/** null for cabinets created before the plans catalog. */
	plan: { key: string; name: string } | null;
};

export type TenantsPage = { data: TenantRow[]; total: number; pageCount: number };

export type TenantDomain = {
	tenantId: string;
	subdomain: string;
	customDomain: string | null;
	sslStatus: "none" | "pending" | "active" | "error";
};

export type Tenant = {
	id: string;
	name: string;
	legalName: string | null;
	slug: string;
	specialty: string | null;
	responsibleName: string;
	address: string | null;
	city: string | null;
	phone: string | null;
	email: string;
	status: TenantStatus;
	trialStartsAt: string | null;
	trialEndsAt: string | null;
	maxDoctors: number | null;
	maxSecretaries: number | null;
	maxUsers: number | null;
	storageQuotaMb: number | null;
	createdAt: string;
	domain: TenantDomain | null;
	subscription: TenantSubscription | null;
	/** false once closed. */
	editable: boolean;
	/** Transitions the API accepts right now (empty while one is scheduled). */
	availableTransitions: TenantTransition[];
	scheduledStatusChange: TenantStatusChange | null;
};

export const SUBSCRIPTION_STATUS_LABELS = {
	trialing: "Essai",
	active: "Active",
	past_due: "Paiement attendu",
	cancelled: "Résiliée",
} as const;

/** The cabinet's live subscription (Module 3). */
export type TenantSubscription = {
	id: string;
	billingPeriod: BillingPeriod;
	/** Centimes per billing period, fixed when the subscription started. */
	price: number;
	status: keyof typeof SUBSCRIPTION_STATUS_LABELS;
	startedAt: string;
	currentPeriodEnd: string | null;
	plan: {
		id: string;
		key: string;
		name: string;
		features: Record<string, FeatureLevel>;
	};
};

// Cabinet lifecycle (Module 2, Scenarios C and D). Mirrors
// apps/admin-api/src/tenants/lifecycle.ts: keep the reason keys in sync.

export type TenantTransition = "suspend" | "reactivate" | "start_closure" | "close";

export const TRANSITIONS: Record<
	TenantTransition,
	{ label: string; description: string; destructive?: boolean; reasons: Record<string, string> }
> = {
	suspend: {
		label: "Suspendre",
		description:
			"Les nouvelles connexions du cabinet seront bloquées. Ses données sont conservées et il pourra être réactivé.",
		destructive: true,
		reasons: {
			unpaid: "Impayé dépassant le délai de grâce",
			owner_request: "Demande du responsable du cabinet",
			fraud: "Fraude ou utilisation abusive",
			security_incident: "Incident de sécurité",
			contract_breach: "Non-respect des conditions contractuelles",
			support_temporary: "Suspension temporaire demandée par le support",
		},
	},
	reactivate: {
		label: "Réactiver",
		description: "Le cabinet retrouve l'accès à la plateforme.",
		reasons: {
			payment_regularized: "Paiement régularisé",
			incident_resolved: "Incident résolu",
			owner_request: "Demande du responsable du cabinet",
			other: "Autre",
		},
	},
	start_closure: {
		label: "Démarrer la fermeture",
		description:
			"Le cabinet entre en période de fermeture : préparez l'export des données avant la fermeture définitive.",
		destructive: true,
		reasons: {
			owner_request: "Demande autorisée du responsable",
			temporary_closure: "Fermeture temporaire",
			contract_end: "Fin de contrat",
			unpaid: "Impayé non régularisé",
			other: "Autre",
		},
	},
	close: {
		label: "Fermer définitivement",
		description:
			"Le cabinet est fermé et ne pourra plus être modifié. Les données ne sont pas supprimées : leur suppression se planifie séparément, après le délai de conservation.",
		destructive: true,
		reasons: {
			closure_period_ended: "Fin de la période de fermeture",
			owner_request: "Demande autorisée du responsable",
			other: "Autre",
		},
	},
};

export type TenantStatusChange = {
	id: string;
	action: TenantTransition;
	fromStatus: TenantStatus;
	toStatus: TenantStatus;
	reason: string | null;
	comment: string | null;
	effectiveAt: string;
	state: "scheduled" | "applied" | "cancelled" | "failed";
};

export const reasonLabel = (action: string, reason: string | null | undefined) =>
	(reason && TRANSITIONS[action as TenantTransition]?.reasons[reason]) || reason || "";

export const changeStatusSchema = z.object({
	reason: z.string().min(1, "Choisissez un motif"),
	comment: z.string().trim().min(3, "Commentaire requis (3 caractères min.)").max(2000),
	/** yyyy-mm-dd; today or empty = applied now. */
	effectiveOn: z.string(),
	notifyResponsible: z.boolean(),
	retentionConfirmed: z.boolean(),
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export type TenantAuditEntry = {
	id: string;
	action: string;
	metadata: Record<string, unknown> | null;
	ip: string | null;
	createdAt: string;
	actor: { id: string; name: string } | null;
};

export type TenantAuditPage = { data: TenantAuditEntry[]; total: number; pageCount: number };

const optional = (max: number) => z.string().trim().max(max);
const quota = z
	.string()
	.trim()
	.refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 0), "Nombre invalide");

/** Module 2, Scenario A — create a cabinet. */
export const createTenantSchema = z.object({
	name: z.string().trim().min(2, "Nom requis").max(120),
	legalName: optional(160),
	responsibleName: z.string().trim().min(2, "Nom du responsable requis").max(120),
	specialty: optional(80),
	address: optional(300),
	city: optional(80),
	phone: optional(30),
	email: z.email("Adresse e-mail invalide"),
	subdomain: z
		.string()
		.trim()
		.toLowerCase()
		.min(2, "Sous-domaine requis")
		.max(63)
		.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Minuscules, chiffres et tirets uniquement"),
	/** Module 3: the plan fills trialDays and the quotas below, which stay editable. */
	planKey: z.string().min(1, "Choisissez une offre"),
	billingPeriod: z.enum(["monthly", "annual"]),
	trialDays: z
		.string()
		.trim()
		.refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 90), {
			message: "Entre 0 et 90",
		}),
	maxDoctors: quota,
	maxSecretaries: quota,
	maxUsers: quota,
	/** Go in the form, Mo in the API. */
	storageQuotaGb: quota,
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const EMPTY_TENANT: CreateTenantInput = {
	name: "",
	legalName: "",
	responsibleName: "",
	specialty: "",
	address: "",
	city: "",
	phone: "",
	email: "",
	subdomain: "",
	planKey: "",
	billingPeriod: "monthly",
	trialDays: "",
	maxDoctors: "",
	maxSecretaries: "",
	maxUsers: "",
	storageQuotaGb: "",
};

const toLimit = (value: string) => (value ? Number(value) : null);
const toStorageMb = (gb: string) => (gb ? Number(gb) * 1024 : null);
export const toStorageGb = (mb: number | null) => (mb === null ? "" : String(Math.round(mb / 1024)));

/** Form values → API body. Quotas are sent as shown (blank = unlimited), overriding the plan's. */
export const toCreateTenantBody = (values: CreateTenantInput) => ({
	name: values.name,
	legalName: values.legalName || undefined,
	responsibleName: values.responsibleName,
	specialty: values.specialty || undefined,
	address: values.address || undefined,
	city: values.city || undefined,
	phone: values.phone || undefined,
	email: values.email,
	subdomain: values.subdomain,
	planKey: values.planKey,
	billingPeriod: values.billingPeriod,
	trialDays: values.trialDays ? Number(values.trialDays) : undefined,
	maxDoctors: toLimit(values.maxDoctors),
	maxSecretaries: toLimit(values.maxSecretaries),
	maxUsers: toLimit(values.maxUsers),
	storageQuotaMb: toStorageMb(values.storageQuotaGb),
});

/** Module 2, Scenario B — the slug, subdomain, plan and trial are not edited here. */
export const updateTenantSchema = createTenantSchema.omit({
	subdomain: true,
	trialDays: true,
	planKey: true,
	billingPeriod: true,
});
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export const toUpdateTenantInput = (tenant: Tenant): UpdateTenantInput => ({
	name: tenant.name,
	legalName: tenant.legalName ?? "",
	responsibleName: tenant.responsibleName,
	specialty: tenant.specialty ?? "",
	address: tenant.address ?? "",
	city: tenant.city ?? "",
	phone: tenant.phone ?? "",
	email: tenant.email,
	maxDoctors: tenant.maxDoctors?.toString() ?? "",
	maxSecretaries: tenant.maxSecretaries?.toString() ?? "",
	maxUsers: tenant.maxUsers?.toString() ?? "",
	storageQuotaGb: toStorageGb(tenant.storageQuotaMb),
});

/** Form values → PATCH body: blank optional fields are cleared (null = no limit for quotas). */
export const toUpdateTenantBody = (values: UpdateTenantInput) => ({
	name: values.name,
	legalName: values.legalName,
	responsibleName: values.responsibleName,
	specialty: values.specialty,
	address: values.address,
	city: values.city,
	phone: values.phone,
	email: values.email,
	maxDoctors: toLimit(values.maxDoctors),
	maxSecretaries: toLimit(values.maxSecretaries),
	maxUsers: toLimit(values.maxUsers),
	storageQuotaMb: toStorageMb(values.storageQuotaGb),
});
