import "server-only";
import type { Branding } from "./settings";

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const FALLBACK: Branding = { platformName: "Cabinova", primaryColor: "#613f75", logoUrl: null };

/** Public branding (works signed out). Falls back to Cabinova if the API is down. */
export async function getBranding(): Promise<Branding> {
	try {
		const res = await fetch(`${API_URL}/branding`, { cache: "no-store" });
		return res.ok ? ((await res.json()) as Branding) : FALLBACK;
	} catch {
		return FALLBACK;
	}
}
