import { z } from "zod";

// Types, labels and form schema of the Tenants API (apps/admin-api/src/tenants).

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
	maxUsers: number | null;
	createdAt: string;
	domain: TenantDomain | null;
};

const optional = (max: number) => z.string().trim().max(max);

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
	trialDays: z
		.string()
		.trim()
		.refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 90), {
			message: "Entre 0 et 90",
		}),
	maxDoctors: z
		.string()
		.trim()
		.refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 0), "Nombre invalide"),
	maxUsers: z
		.string()
		.trim()
		.refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 0), "Nombre invalide"),
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
	trialDays: "7",
	maxDoctors: "",
	maxUsers: "",
};

/** Form values → API body (numeric fields as numbers or omitted). */
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
	trialDays: values.trialDays ? Number(values.trialDays) : undefined,
	maxDoctors: values.maxDoctors ? Number(values.maxDoctors) : undefined,
	maxUsers: values.maxUsers ? Number(values.maxUsers) : undefined,
});
