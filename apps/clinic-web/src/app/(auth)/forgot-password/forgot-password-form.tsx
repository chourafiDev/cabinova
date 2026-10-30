"use client";

import { LuLoader, LuMailCheck } from "react-icons/lu";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { AuthLabel, authButtonClass, authInputClass } from "../_components/auth-fields";

export function ForgotPasswordForm() {
	const [sent, setSent] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const email = String(new FormData(e.currentTarget).get("email")).trim();
		setPending(true);
		setError(null);
		try {
			await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
			setSent(email);
		} catch (err) {
			setError(
				err instanceof ApiError && err.status === 429
					? "Trop de demandes. Patientez une minute puis réessayez."
					: "Une erreur est survenue. Réessayez.",
			);
		} finally {
			setPending(false);
		}
	}

	if (sent) {
		return (
			<div className="mt-10 grid gap-6 text-center">
				<LuMailCheck className="text-primary mx-auto size-8" />
				<p className="text-sm">
					Si un compte existe pour <strong>{sent}</strong>, un lien vient de partir. Il est valable 1 heure. Pensez à
					vérifier vos courriers indésirables.
				</p>
				<Link href="/login" className="text-sm font-medium hover:underline">
					Retour à la connexion
				</Link>
			</div>
		);
	}

	return (
		<form onSubmit={onSubmit} className="mt-10 grid gap-6">
			<div className="grid gap-2">
				<AuthLabel htmlFor="email">Adresse e-mail</AuthLabel>
				<Input
					id="email"
					name="email"
					type="email"
					autoFocus
					autoComplete="email"
					placeholder="Entrez votre adresse e-mail"
					required
					className={authInputClass}
				/>
			</div>
			{error && (
				<p role="alert" className="text-destructive -mt-2 text-sm">
					{error}
				</p>
			)}
			<Button type="submit" disabled={pending} className={authButtonClass}>
				{pending && <LuLoader className="size-4 animate-spin" />}
				Envoyer le lien
			</Button>
			<Link href="/login" className="text-muted-foreground hover:text-foreground text-center text-sm">
				Retour à la connexion
			</Link>
		</form>
	);
}
