import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { apiGet } from "@/lib/server-api";
import { getClinicState } from "@/lib/session";
import type { DeviceSession, TwoFactorStatus } from "@/lib/settings";
import { DevicesCard } from "./_components/devices-card";
import { PasswordForm } from "./_components/password-form";
import { ProfileForm } from "./_components/profile-form";
import { TwoFactorCard } from "./_components/two-factor-card";

export const metadata: Metadata = { title: "Mon profil · Paramètres" };

export default async function ProfileSettingsPage() {
	const [state, sessions, twoFactor] = await Promise.all([
		getClinicState(),
		apiGet<DeviceSession[]>("/settings/sessions"),
		apiGet<TwoFactorStatus>("/auth/2fa"),
	]);
	if (state.status !== "signed-in") redirect("/login");
	const { user } = state.session;

	return (
		<>
			<ProfileForm name={user.name} email={user.email} roleLabel={user.roleLabel} />
			<PasswordForm />
			<TwoFactorCard status={twoFactor} />
			<DevicesCard sessions={sessions} />
		</>
	);
}
