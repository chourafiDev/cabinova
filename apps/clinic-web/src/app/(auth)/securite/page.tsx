import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCabinet, getClinicState } from "@/lib/session";
import { AuthCard } from "../_components/auth-card";
import { SecuritySetup } from "./security-setup";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return { title: t("security.meta") };
}

/** The cabinet requires 2FA: nothing else opens until it's set up. */
export default async function SecurityPage() {
	const [found, state] = await Promise.all([getCabinet(), getClinicState()]);
	if (state.status !== "signed-in" || "reason" in found) redirect("/login");
	if (!state.session.user.twoFactorSetupRequired) redirect("/");
	const t = await getTranslations("auth.security");
	return (
		<AuthCard
			cabinet={found.cabinet}
			languages={false}
			title={t("title")}
			description={t("description")}
		>
			<div className="mt-8">
				<SecuritySetup />
			</div>
		</AuthCard>
	);
}
