import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/titles";
import { type Practitioner } from "@/lib/appointments";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { type AgendaSettings, DEFAULT_OPENING_HOURS } from "@/lib/settings";
import { spaceLabel } from "@/lib/spaces";
import { Agenda } from "./_components/agenda";
import { AppointmentsTabs } from "./_components/appointments-tabs";

export const generateMetadata = () => pageTitle("appointments");

/** The waiting room and the current space's agenda. Every member of its staff books and moves appointments. */
export default async function AppointmentsPage() {
	const [practitioners, state, agenda] = await Promise.all([
		apiGet<Practitioner[]>("/appointments/practitioners"),
		getClinicState(),
		apiGet<AgendaSettings>("/settings/agenda"),
	]);
	const space = state.status === "signed-in" ? state.session.spaces?.current : undefined;
	const t = await getTranslations("agenda");

	return (
		<AppointmentsTabs
			agenda={
				<>
					{space && (
						<p className="text-muted-foreground text-sm">
							{t("spaceAgenda")} <span className="text-foreground font-medium">{spaceLabel(space)}</span>
						</p>
					)}
					<Agenda
						practitioners={practitioners}
						canWrite
						openingHours={space?.openingHours ?? DEFAULT_OPENING_HOURS}
						defaultDuration={agenda.defaultAppointmentMinutes}
					/>
				</>
			}
		/>
	);
}
