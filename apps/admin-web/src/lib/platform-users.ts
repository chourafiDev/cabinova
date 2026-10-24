import type { Permission } from "./permissions";

// Types and labels of the Module 5 API (apps/admin-api/src/platform-users).

export type PlatformUserStatus = "active" | "invited" | "disabled";

export const USER_STATUS_LABELS: Record<PlatformUserStatus, string> = {
	active: "Actif",
	invited: "Invité",
	disabled: "Désactivé",
};

export type PlatformUserRow = {
	id: string;
	name: string;
	email: string;
	status: PlatformUserStatus;
	inviteExpired: boolean;
	lastLoginAt: string | null;
	createdAt: string;
	roles: { key: string; name: string }[];
};

export type OverrideEffect = "grant" | "deny";

export type PlatformUserDetail = Omit<PlatformUserRow, "roles"> & {
	roles: { key: string; name: string }[];
	overrides: Partial<Record<Permission, OverrideEffect>>;
	/** Effective: role permissions + grants − denies. */
	permissions: Permission[];
	sessions: { id: string; createdAt: string; expiresAt: string; userAgent: string | null; ip: string | null }[];
};

export type PlatformRole = {
	id: string;
	key: string;
	name: string;
	description: string | null;
	/** Super Admin: always every permission, not editable. */
	locked: boolean;
	permissions: Permission[];
	userCount: number;
};

export type PermissionInfo = { key: Permission; resource: string; action: string; description: string };

export type UserHistoryEntry = {
	id: string;
	action: string;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	actor: { id: string; name: string } | null;
};

export const RESOURCE_LABELS: Record<string, string> = {
	dashboard: "Tableau de bord",
	tenants: "Cabinets",
	subscriptions: "Offres et abonnements",
	billing: "Facturation",
	technical: "Technique",
	users: "Utilisateurs et permissions",
	support: "Support",
	security: "Sécurité et audit",
	settings: "Configuration",
};

/** Catalog grouped by resource, in catalog order. */
export function groupPermissions(catalog: PermissionInfo[]) {
	const groups = new Map<string, PermissionInfo[]>();
	for (const p of catalog) groups.set(p.resource, [...(groups.get(p.resource) ?? []), p]);
	return [...groups.entries()].map(([resource, permissions]) => ({
		resource,
		label: RESOURCE_LABELS[resource] ?? resource,
		permissions,
	}));
}

/** Same rule as the API: role permissions + grants − denies. */
export function effectivePermissions(
	roles: PlatformRole[],
	roleKeys: string[],
	overrides: Partial<Record<string, OverrideEffect>>,
) {
	const set = new Set<string>(roles.filter((r) => roleKeys.includes(r.key)).flatMap((r) => r.permissions));
	for (const [key, effect] of Object.entries(overrides)) {
		if (effect === "grant") set.add(key);
		if (effect === "deny") set.delete(key);
	}
	return set;
}
