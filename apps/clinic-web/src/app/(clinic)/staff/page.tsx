import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import type { Team } from "@/lib/team";
import { TeamManager } from "./_components/team-manager";

export const metadata: Metadata = { title: "Équipe" };

/** The responsible doctor's staff: invitations, roles, spaces, access. */
export default async function StaffPage() {
	const state = await getClinicState();
	if (state.status !== "signed-in" || state.session.user.role !== "owner") notFound();
	const team = await apiGet<Team>("/team");
	return <TeamManager team={team} plan={state.session.subscription.plan} />;
}
