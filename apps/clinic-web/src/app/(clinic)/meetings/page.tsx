import { redirect } from "next/navigation";
import { pageTitle } from "@/i18n/titles";
import type { MeetingList } from "@/lib/meetings";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { MeetingsView } from "./_components/meetings-view";

export const generateMetadata = () => pageTitle("meetings");

/** Réunions: the team's Google Meet calls, running, coming and past. */
export default async function MeetingsPage() {
	const state = await getClinicState();
	if (state.status !== "signed-in") redirect("/login");
	const meetings = await apiGet<MeetingList>("/meetings");
	return <MeetingsView initial={meetings} isOwner={state.session.user.role === "owner"} />;
}
