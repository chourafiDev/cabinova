import { redirect } from "next/navigation";
import { pageTitle } from "@/i18n/titles";
import type { Practitioner } from "@/lib/appointments";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { AbsencesView } from "./_components/absences-view";

export const generateMetadata = () => pageTitle("absences");

/** Congés et absences: the days the cabinet or a doctor doesn't work. The agenda closes them. */
export default async function AbsencesPage() {
	const state = await getClinicState();
	if (state.status !== "signed-in") redirect("/login");
	const practitioners = await apiGet<Practitioner[]>("/appointments/practitioners");
	const { id, role } = state.session.user;
	return <AbsencesView practitioners={practitioners} user={{ id, role }} />;
}
