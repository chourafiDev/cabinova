// Platform permission catalog shared with admin-api
// (apps/admin-api/src/auth/permissions.ts). A user's effective permissions =
// role defaults + user grants − user denies, computed by the API at login.

export const PERMISSIONS = [
  "dashboard:read",
  "tenants:read",
  "tenants:write",
  "tenants:data",
  "subscriptions:read",
  "subscriptions:write",
  "billing:read",
  "billing:write",
  "technical:read",
  "technical:write",
  "users:read",
  "users:write",
  "support:read",
"support:write",
  "support:all",
  "security:read",
  "settings:read",
  "settings:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function can(permissions: readonly string[] | undefined, permission: Permission) {
  return !!permissions?.includes(permission);
}
