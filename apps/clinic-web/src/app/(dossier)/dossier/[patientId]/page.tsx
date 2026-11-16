import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Practitioner } from "@/lib/appointments";
import { isMedicalRole, patientHref } from "@/lib/patients";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { type AgendaSettings, DEFAULT_OPENING_HOURS } from "@/lib/settings";
import { DossierView } from "./_components/dossier-view";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("dossier");
	return { title: t("title") };
}

/**
 * /dossier/<patient>?visit=<appointment>: the doctor's page for one patient —
 * today's consultation in the middle, the antécédents and the history around
 * it. The front desk keeps the patient sheet.
 */
export default async function DossierPage({
	params,
	searchParams,
}: {
	params: Promise<{ patientId: string }>;
	searchParams: Promise<{ visit?: string }>;
}) {
	const [{ patientId }, { visit }, state] = await Promise.all([params, searchParams, getClinicState()]);
	if (state.status !== "signed-in" || !isMedicalRole(state.session.user.role)) redirect(patientHref(patientId));
	// What the "Rendez-vous" dialog needs, as on the agenda page.
	const [practitioners, agenda] = await Promise.all([
		apiGet<Practitioner[]>("/appointments/practitioners"),
		apiGet<AgendaSettings>("/settings/agenda"),
	]);
	return (
		<DossierView
			// Another patient or visit starts from a clean page.
			key={`${patientId}-${visit ?? ""}`}
			patientId={patientId}
			visitId={visit ?? null}
			booking={{
				practitioners,
				openingHours: state.session.spaces?.current.openingHours ?? DEFAULT_OPENING_HOURS,
				defaultDuration: agenda.defaultAppointmentMinutes,
				openHolidays: agenda.openHolidays,
			}}
		/>
	);
}
