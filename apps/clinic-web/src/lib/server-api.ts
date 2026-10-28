import "server-only";
import { headers } from "next/headers";

const CLINIC_API_URL = process.env.CLINIC_API_URL ?? "http://localhost:4100";

/**
 * Calls clinic-api from a server component, as the current visitor: their
 * host (the API reads the cabinet from it), session cookie and IP.
 */
export async function serverApi(path: string) {
	const h = await headers();
	const clientIp = h.get("x-forwarded-for") ?? h.get("x-real-ip");
	try {
		return await fetch(`${CLINIC_API_URL}${path}`, {
			headers: {
				cookie: h.get("cookie") ?? "",
				"x-forwarded-host": h.get("host") ?? "",
				...(clientIp && { "x-forwarded-for": clientIp }),
			},
			cache: "no-store",
		});
	} catch (err) {
		// clinic-api down or not started: a page saying so, not a crash.
		console.error(`clinic-api unreachable at ${CLINIC_API_URL}`, err);
		return Response.json(
			{
				code: "SERVICE_UNAVAILABLE",
				message: "Le service est momentanément indisponible. Réessayez dans un instant.",
			},
			{ status: 503 },
		);
	}
}

/** The cabinet can't be used at this address (unknown, not ready, suspended). */
export type Unavailable = { code: string; message: string };

/**
 * 403/404 from the cabinet check (TENANT_*) or the API being unreachable
 * (SERVICE_UNAVAILABLE), or null for any other response.
 */
export async function unavailableFrom(res: Response): Promise<Unavailable | null> {
	if (res.status !== 403 && res.status !== 404 && res.status !== 503) return null;
	const body = await res
		.clone()
		.json()
		.catch(() => null);
	return typeof body?.code === "string" &&
		(body.code.startsWith("TENANT_") || body.code === "SERVICE_UNAVAILABLE")
		? { code: body.code, message: body.message }
		: null;
}
