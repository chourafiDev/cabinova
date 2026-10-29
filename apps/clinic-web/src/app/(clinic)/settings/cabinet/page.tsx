import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import type { CabinetIdentity } from "@/lib/settings";
import { CabinetForm } from "./_components/cabinet-form";

export const metadata: Metadata = { title: "Cabinet · Paramètres" };

/** The responsible doctor only (the API refuses others too). */
export default async function CabinetSettingsPage() {
	const state = await getClinicState();
	if (state.status !== "signed-in" || state.session.user.role !== "owner") notFound();
	const cabinet = await apiGet<CabinetIdentity>("/settings/cabinet");
	return <CabinetForm initial={cabinet} />;
}
