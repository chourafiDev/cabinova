import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Act } from "@/lib/payments";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import { ActsManager } from "./_components/acts-manager";

export const metadata: Metadata = { title: "Tarifs · Paramètres" };

/** The responsible doctor's price list, offered when checking out a visit. */
export default async function TarifsSettingsPage() {
	const state = await getClinicState();
	if (state.status !== "signed-in" || state.session.user.role !== "owner") notFound();
	const acts = await apiGet<Act[]>("/acts?archived=true");
	return <ActsManager acts={acts} />;
}
