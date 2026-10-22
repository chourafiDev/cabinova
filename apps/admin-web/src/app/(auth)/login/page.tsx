import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, getTenant } from "@/lib/session";
import { AuthCard } from "../_components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

// Only allow redirecting back inside the app (prevents open redirects).
function safeNext(next: string | string[] | undefined) {
	return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
	const next = safeNext((await searchParams).next);
	const tenant = await getTenant();

	if (!tenant) {
		return (
			<AuthCard
				tenantName="Cabinova"
				title="Clinique introuvable"
				description="Vérifiez l'adresse de votre espace : nom-de-la-clinique.cabinova.ma"
			/>
		);
	}
	if (await getSession()) redirect(next);

	return (
		<AuthCard tenantName={tenant.name} title="Bon retour" description="Connectez-vous pour gérer votre clinique.">
			<LoginForm next={next} />
		</AuthCard>
	);
}
