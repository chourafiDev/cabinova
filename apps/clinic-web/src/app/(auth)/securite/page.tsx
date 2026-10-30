import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCabinet, getClinicState } from "@/lib/session";
import { AuthCard } from "../_components/auth-card";
import { SecuritySetup } from "./security-setup";

export const metadata: Metadata = { title: "Double authentification" };

/** The cabinet requires 2FA: nothing else opens until it's set up. */
export default async function SecurityPage() {
	const [found, state] = await Promise.all([getCabinet(), getClinicState()]);
	if (state.status !== "signed-in" || "reason" in found) redirect("/login");
	if (!state.session.user.twoFactorSetupRequired) redirect("/");
	return (
		<AuthCard
			cabinet={found.cabinet}
			title="Sécurisez votre compte"
			description="Votre cabinet exige la double authentification. Elle prend une minute."
		>
			<div className="mt-8">
				<SecuritySetup />
			</div>
		</AuthCard>
	);
}
