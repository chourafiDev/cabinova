import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import type { AgendaSettings, ManagedSpace } from "@/lib/settings";
import { DefaultDurationCard } from "./_components/default-duration-card";
import { OpeningHoursEditor } from "./_components/opening-hours-editor";

export const metadata: Metadata = { title: "Horaires & agenda · Paramètres" };

/** Opening hours of one space (?espace=, default: the current one) and the cabinet's booking default. */
export default async function HoursSettingsPage({ searchParams }: { searchParams: Promise<{ espace?: string }> }) {
	const state = await getClinicState();
	if (state.status !== "signed-in" || state.session.user.role !== "owner") notFound();
	const [all, agenda, { espace }] = await Promise.all([
		apiGet<ManagedSpace[]>("/spaces/manage"),
		apiGet<AgendaSettings>("/settings/agenda"),
		searchParams,
	]);
	const spaces = all.filter((s) => s.active);
	const space =
		spaces.find((s) => s.id === espace) ??
		spaces.find((s) => s.id === state.session.spaces?.current.id) ??
		spaces[0];

	return (
		<>
			{space && <OpeningHoursEditor key={space.id} space={space} spaces={spaces} />}
			<DefaultDurationCard initial={agenda.defaultAppointmentMinutes} />
		</>
	);
}
