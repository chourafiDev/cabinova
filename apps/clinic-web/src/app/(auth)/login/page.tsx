import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabinetUnavailable } from "@/components/cabinet-unavailable";
import { getCabinet, getClinicState } from "@/lib/session";
import { AuthCard } from "../_components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

// Only allow redirecting back inside the app (prevents open redirects).
function safeNext(next: string | string[] | undefined) {
	return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
	const next = safeNext((await searchParams).next);
	const found = await getCabinet();
	if ("reason" in found) return <CabinetUnavailable reason={found.reason} />;
	if ((await getClinicState()).status === "signed-in") redirect(next);

	return (
		<AuthCard cabinet={found.cabinet} title="Connexion" description="Accédez à l’espace de votre cabinet.">
			<LoginForm next={next} />
		</AuthCard>
	);
}
