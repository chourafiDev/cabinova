import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Calls admin-api from a server component, as the current visitor: forwards
 * their session cookie. There's no tenant to resolve — admin-web runs on
 * one domain only.
 */
export async function serverApi(path: string) {
	const h = await headers();
	return fetch(`${API_URL}${path}`, {
		headers: { cookie: h.get("cookie") ?? "" },
		cache: "no-store",
	});
}

/**
 * GET for server pages: signed out → login, forbidden or missing → 404 page.
 */
export async function apiGet<T>(path: string): Promise<T> {
	const res = await serverApi(path);
	if (res.status === 401) redirect("/login");
	if (res.status === 403 || res.status === 404) notFound();
	if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
	return res.json();
}
