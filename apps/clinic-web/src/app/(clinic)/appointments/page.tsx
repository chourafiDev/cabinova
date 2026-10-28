import type { Metadata } from "next";
import { type Practitioner } from "@/lib/appointments";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { spaceLabel } from "@/lib/spaces";
import { Agenda } from "./_components/agenda";

export const metadata: Metadata = { title: "Agenda" };

/** The current space's agenda. Every member of its staff books and moves appointments. */
export default async function AppointmentsPage() {
	const [practitioners, state] = await Promise.all([
		apiGet<Practitioner[]>("/appointments/practitioners"),
		getClinicState(),
	]);
	const space = state.status === "signed-in" ? state.session.spaces?.current : undefined;

	return (
		<div className="grid gap-3">
			{space && (
				<p className="text-muted-foreground text-sm">
					Agenda de l’espace <span className="text-foreground font-medium">{spaceLabel(space)}</span>
				</p>
			)}
			<Agenda practitioners={practitioners} canWrite />
		</div>
	);
}
