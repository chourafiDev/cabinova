"use client";

import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { AuthLabel, authButtonClass, authInputClass } from "../_components/auth-fields";

export function LoginForm({ next }: { next: string }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [remember, setRemember] = useState(true);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		setPending(true);
		setError(null);

		try {
			await api("/auth/login", {
				method: "POST",
				body: JSON.stringify({
					email: String(form.get("email")),
					password: String(form.get("password")),
					// Unchecked: the session ends when the browser closes (shared computers).
					rememberMe: remember,
				}),
			});
		} catch (err) {
			setPending(false);
			setError(
				err instanceof ApiError && err.status === 429
					? "Trop de tentatives. Patientez une minute puis réessayez."
					: "E-mail ou mot de passe incorrect.",
			);
			return;
		}
		router.replace(next);
		router.refresh();
	}

	return (
		<form onSubmit={onSubmit} className="mt-10 grid gap-6">
			<div className="grid gap-2">
				<AuthLabel htmlFor="email">Adresse e-mail</AuthLabel>
				<Input
					id="email"
					name="email"
					type="email"
					autoComplete="email"
					placeholder="Entrez votre adresse e-mail"
					required
					className={authInputClass}
				/>
			</div>
			<div className="grid gap-2">
				<AuthLabel htmlFor="password">Mot de passe</AuthLabel>
				<PasswordInput
					id="password"
					name="password"
					autoComplete="current-password"
					placeholder="Entrez votre mot de passe"
					required
					className={authInputClass}
				/>
			</div>
			<div className="flex items-center justify-between gap-4">
				<label className="text-muted-foreground flex items-center gap-2.5 text-sm">
					<Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
					Se souvenir de moi
				</label>
			</div>
			{error && (
				<p role="alert" className="text-destructive -mt-2 text-sm">
					{error}
				</p>
			)}
			<Button type="submit" disabled={pending} className={authButtonClass}>
				{pending && <Loader className="size-4 animate-spin" />}
				{pending ? "Connexion…" : "Se connecter"}
			</Button>
			<p className="text-muted-foreground text-center text-sm">
				Pas encore d&apos;accès ?{" "}
				<span className="text-foreground">Demandez une invitation au Super Admin.</span>
			</p>
		</form>
	);
}
