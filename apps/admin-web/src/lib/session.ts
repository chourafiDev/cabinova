import "server-only";
import { cache } from "react";
import type { Permission } from "./permissions";
import { serverApi } from "./server-api";

export type SessionUser = {
	id: string;
	name: string;
	email: string;
	roles: { key: string; name: string }[];
	permissions: Permission[];
};

export type Session = { user: SessionUser };

/** Current platform session (GET /auth/me), or null when signed out. Once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
	const res = await serverApi("/auth/me");
	if (res.status === 401) return null;
	if (!res.ok) throw new Error(`GET /auth/me failed: ${res.status}`);
	return res.json();
});
