import { notFound } from "next/navigation";
import { settingsTitle } from "@/i18n/titles";
import type { GoogleStatus } from "@/lib/meetings";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { GoogleCard } from "./_components/google-card";

export const generateMetadata = () => settingsTitle("integrations");

const OUTCOMES = ["connected", "denied", "scope", "error"] as const;
type Outcome = (typeof OUTCOMES)[number];

/** Outside services the cabinet uses; for now Google, behind team meetings. */
export default async function IntegrationsPage({ searchParams }: PageProps<"/settings/integrations">) {
	const state = await getClinicState();
	if (state.status !== "signed-in" || state.session.user.role !== "owner") notFound();
	const google = await apiGet<GoogleStatus>("/integrations/google");
	// Set by clinic-api when Google sends the browser back.
	const outcome = (await searchParams).google;
	return (
		<GoogleCard
			status={google}
			outcome={OUTCOMES.includes(outcome as Outcome) ? (outcome as Outcome) : null}
		/>
	);
}
