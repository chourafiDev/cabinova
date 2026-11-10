import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { settingsTitle } from "@/i18n/titles";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import type { DeviceSession, TwoFactorStatus } from "@/lib/settings";
import { DevicesCard } from "./_components/devices-card";
import { LanguageCard } from "./_components/language-card";
import { PasswordForm } from "./_components/password-form";
import { ProfileForm } from "./_components/profile-form";
import { TwoFactorCard } from "./_components/two-factor-card";

export const generateMetadata = () => settingsTitle("profile");

export default async function ProfileSettingsPage() {
	const [state, sessions, twoFactor] = await Promise.all([
		getClinicState(),
		apiGet<DeviceSession[]>("/settings/sessions"),
		apiGet<TwoFactorStatus>("/auth/2fa"),
	]);
	if (state.status !== "signed-in") redirect("/login");
	const { user } = state.session;
	const t = await getTranslations("common.roles");

	return (
		<>
			<ProfileForm name={user.name} email={user.email} roleLabel={t(user.role)} />
			<LanguageCard />
			<PasswordForm />
			<TwoFactorCard status={twoFactor} />
			<DevicesCard sessions={sessions} />
		</>
	);
}
