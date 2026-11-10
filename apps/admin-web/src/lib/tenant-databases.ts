import type { TenantStatus } from "./tenants";

// Types and labels of the Module 4 API (apps/admin-api/src/tenant-databases).

export type TenantDatabase = {
	tenantId: string;
	provider: string;
	mode: string;
	host: string | null;
	databaseName: string | null;
	roleName: string | null;
	/** Tag of the last tenant-db migration applied, e.g. "0000_baseline". */
	schemaVersion: string | null;
	lastMigratedAt: string | null;
	lastMigrationError: string | null;
	lastHealthCheckAt: string | null;
	healthy: boolean | null;
	lastHealthError: string | null;
	latencyMs: number | null;
	/** pg_database_size at the last check. */
	sizeBytes: number | null;
	sizeCheckedAt: string | null;
	createdAt: string;
};

/** "12,4 Mo" / "1,2 Go" */
export const formatBytes = (bytes: number) =>
	bytes >= 1024 ** 3
		? `${(bytes / 1024 ** 3).toFixed(1).replace(".", ",")} Go`
		: `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} Mo`;

export type ProvisioningStep = {
	key: string;
	status: "done" | "skipped" | "failed";
	at: string;
	detail?: string;
};

export type ProvisioningRun = {
	id: string;
	state: "running" | "succeeded" | "failed";
	steps: ProvisioningStep[];
	error: string | null;
	sendInvitation: boolean;
	startedAt: string;
	finishedAt: string | null;
};

/** GET /tenants/:id/database */
export type TenantDatabaseInfo = {
	database: TenantDatabase | null;
	latestSchemaVersion: string | null;
	/** false until TENANT_SECRETS_KEY is set on the API. */
	configured: boolean;
	runs: ProvisioningRun[];
};

/** GET /tenant-databases */
export type TenantDatabasesOverview = {
	latestSchemaVersion: string | null;
	total: number;
	behind: number;
	unhealthy: number;
	failedMigrations: number;
	data: (TenantDatabase & { tenantName: string; tenantStatus: TenantStatus })[];
};

/** Provisioning steps in execution order (Scenario A, system side). */
export const PROVISIONING_STEPS: Record<string, string> = {
	database: "Création de la base et du rôle",
	migrations: "Migrations du schéma",
	seed: "Profil du cabinet et compte du responsable",
	healthcheck: "Test de connexion",
	invitation: "Invitation du médecin responsable",
	activate: "Activation du cabinet",
};
