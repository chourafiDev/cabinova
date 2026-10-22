import "server-only";
import { cache } from "react";
import type { Permission } from "./permissions";
import { serverApi } from "./server-api";

export type Tenant = { id: string; name: string; slug: string; logoUrl: string | null };

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roles: { key: string; name: string }[];
  permissions: Permission[];
};

export type Session = { user: SessionUser; tenant: Tenant };

/** Current session (GET /auth/me), or null when signed out. Once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const res = await serverApi("/auth/me");
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /auth/me failed: ${res.status}`);
  return res.json();
});

/** The clinic of the current subdomain, or null if there is none. */
export const getTenant = cache(async (): Promise<Tenant | null> => {
  const res = await serverApi("/tenants/current");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /tenants/current failed: ${res.status}`);
  return res.json();
});
