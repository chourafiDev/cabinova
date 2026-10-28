import "server-only";
import { cache } from "react";
import { type Unavailable, serverApi, unavailableFrom } from "./server-api";

export type ClinicSession = {
	user: { id: string; name: string; email: string; role: string; roleLabel: string };
	cabinet: { name: string; specialty: string | null; city: string | null; subdomain: string };
	subscription: {
		plan: string | null;
		status: "trialing" | "active" | "past_due" | "cancelled" | null;
		trialEndsAt: string | null;
		currentPeriodEnd: string | null;
		doctors: { used: number; max: number | null };
		secretaries: { used: number; max: number | null };
		storage: { usedMb: number | null; quotaMb: number | null };
	};
	/** First-sign-in product tour finished or skipped (saved per account). */
	onboarding: { tourCompleted: boolean };
};

export type ClinicState =
	| { status: "signed-in"; session: ClinicSession }
	| { status: "signed-out" }
	| { status: "unavailable"; reason: Unavailable };

/** Who is signed in to this cabinet (GET /auth/me). Once per request. */
export const getClinicState = cache(async (): Promise<ClinicState> => {
	const res = await serverApi("/auth/me");
	if (res.ok) return { status: "signed-in", session: await res.json() };
	const reason = await unavailableFrom(res);
	if (reason) return { status: "unavailable", reason };
	if (res.status === 401) return { status: "signed-out" };
	throw new Error(`GET /auth/me failed: ${res.status}`);
});

export type CabinetInfo = Pick<ClinicSession["cabinet"], "name" | "specialty" | "city" | "subdomain">;

/** The cabinet's public identity, for the sign-in pages. */
export async function getCabinet(): Promise<{ cabinet: CabinetInfo } | { reason: Unavailable }> {
	const res = await serverApi("/clinic");
	if (res.ok) return { cabinet: await res.json() };
	const reason = await unavailableFrom(res);
	if (reason) return { reason };
	throw new Error(`GET /clinic failed: ${res.status}`);
}
