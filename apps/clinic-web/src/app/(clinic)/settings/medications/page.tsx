import { notFound } from "next/navigation";
import { settingsTitle } from "@/i18n/titles";
import { getClinicState } from "@/lib/session";
import { MedicationsManager } from "./_components/medications-manager";

export const generateMetadata = () => settingsTitle("medications");

/** Mes médicaments: each doctor's own take on the AMMPS list and their own products. */
export default async function MedicationsSettingsPage() {
	const state = await getClinicState();
	if (state.status !== "signed-in" || !["owner", "doctor"].includes(state.session.user.role)) notFound();
	return <MedicationsManager />;
}
