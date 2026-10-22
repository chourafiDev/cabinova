// Permission catalog shared with the API (apps/api/src/auth/permissions.ts).
// Format "resource:action". A user's effective permissions = role defaults
// + user grants − user denies, computed by the API at login.

export const PERMISSIONS = [
  "dashboard:read",
  "appointments:read",
  "appointments:write",
  "patients:read",
  "patients:write",
  "patients:delete",
  "emr:read",
  "emr:write",
  "documents:read",
  "documents:write",
  "billing:read",
  "billing:write",
  "reports:read",
  "users:read",
  "users:write",
  "settings:read",
  "settings:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function can(permissions: readonly string[] | undefined, permission: Permission) {
  return !!permissions?.includes(permission);
}
