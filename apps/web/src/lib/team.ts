// Types of the Équipe API (apps/api/src/users).
import type { Permission } from "./permissions";

export type RoleRef = { id: string; key: string; name: string };

export type Member = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  /** false until they chose a password from their invitation link. */
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: RoleRef[];
};

export type Override = { permission: Permission; effect: "grant" | "deny" };

export type MemberDetail = Member & { overrides: Override[] };

export type Role = RoleRef & { description: string | null; permissions: Permission[] };

export type PermissionInfo = {
  key: Permission;
  resource: string;
  action: string;
  description: string | null;
};

/** Section titles of the permission list, in display order. */
export const RESOURCE_LABELS: Record<string, string> = {
  dashboard: "Tableau de bord",
  appointments: "Agenda",
  patients: "Patients",
  emr: "Dossier médical",
  documents: "Ordonnances et documents",
  billing: "Facturation",
  reports: "Rapports",
  users: "Équipe",
  settings: "Réglages",
};
