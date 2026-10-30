import type { Metadata } from "next";
import { CabinetUnavailable } from "@/components/cabinet-unavailable";
import { getCabinet } from "@/lib/session";
import { AuthCard } from "../_components/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
	const found = await getCabinet();
	if ("reason" in found) return <CabinetUnavailable reason={found.reason} />;
	return (
		<AuthCard
			cabinet={found.cabinet}
			title="Mot de passe oublié"
			description="Saisissez votre e-mail : nous vous envoyons un lien pour en choisir un nouveau."
		>
			<ForgotPasswordForm />
		</AuthCard>
	);
}
