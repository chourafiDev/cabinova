import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuthCard } from "../_components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

// Only allow redirecting back inside the app (prevents open redirects).
function safeNext(next: string | string[] | undefined) {
	return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
	const next = safeNext((await searchParams).next);
	if (await getSession()) redirect(next);

	return (
		<AuthCard title="Super Admin" description="Connectez-vous pour administrer la plateforme.">
			<LoginForm next={next} />
		</AuthCard>
	);
}
