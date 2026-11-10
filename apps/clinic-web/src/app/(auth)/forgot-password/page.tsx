import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CabinetUnavailable } from "@/components/cabinet-unavailable";
import { getCabinet } from "@/lib/session";
import { AuthCard } from "../_components/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return { title: t("forgot.meta") };
}

export default async function ForgotPasswordPage() {
	const found = await getCabinet();
	if ("reason" in found) return <CabinetUnavailable reason={found.reason} />;
	const t = await getTranslations("auth.forgot");
	return (
		<AuthCard
			cabinet={found.cabinet}
			title={t("title")}
			description={t("description")}
		>
			<ForgotPasswordForm />
		</AuthCard>
	);
}
