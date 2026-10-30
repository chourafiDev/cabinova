import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import type { TeamSession } from "@/lib/settings";
import { TeamSessions } from "./_components/team-sessions";

export const metadata: Metadata = { title: "Sessions actives · Paramètres" };

/** Who is signed in, on what, and since when: for the responsible doctor. */
export default async function SessionsPage() {
	const state = await getClinicState();
	if (state.status !== "signed-in" || state.session.user.role !== "owner") notFound();
	const sessions = await apiGet<TeamSession[]>("/team/sessions");
	return <TeamSessions sessions={sessions} ownId={state.session.user.id} />;
}
