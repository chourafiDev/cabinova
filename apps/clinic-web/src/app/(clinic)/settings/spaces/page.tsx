import { notFound } from "next/navigation";
import { settingsTitle } from "@/i18n/titles";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import type { ManagedSpace } from "@/lib/settings";
import { SpacesManager } from "./_components/spaces-manager";

export const generateMetadata = () => settingsTitle("spaces");

export default async function SpacesSettingsPage() {
	const state = await getClinicState();
	if (state.status !== "signed-in" || state.session.user.role !== "owner") notFound();
	const spaces = await apiGet<ManagedSpace[]>("/spaces/manage");
	return <SpacesManager spaces={spaces} currentId={state.session.spaces?.current.id ?? null} />;
}
