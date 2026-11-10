import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { CabinetUnavailable } from "@/components/cabinet-unavailable";
import { getCabinet, getClinicState } from "@/lib/session";
import { AuthCard } from "../_components/auth-card";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return { title: t("login.meta") };
}

// Only allow redirecting back inside the app (prevents open redirects).
function safeNext(next: string | string[] | undefined) {
	return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
	const next = safeNext((await searchParams).next);
	const found = await getCabinet();
	if ("reason" in found) return <CabinetUnavailable reason={found.reason} />;
	if ((await getClinicState()).status === "signed-in") redirect(next);
	const t = await getTranslations("auth.login");

	return (
		<AuthCard cabinet={found.cabinet} title={t("title")} description={t("description")}>
			<LoginForm next={next} />
		</AuthCard>
	);
}
