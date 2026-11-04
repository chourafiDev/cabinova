import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isMedicalRole, patientHref } from "@/lib/patients";
import { getClinicState } from "@/lib/session";
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
	return <DossierView patientId={patientId} visitId={visit ?? null} />;
}
