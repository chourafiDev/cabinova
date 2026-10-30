"use client";

import { LuLoader } from "react-icons/lu";
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
	/** Password accepted: the second step. */
	const [challenge, setChallenge] = useState<string | null>(null);
	const [useBackup, setUseBackup] = useState(false);
	const [code, setCode] = useState("");

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		setPending(true);
		setError(null);
		try {
			const result = await api<{ twoFactorRequired?: boolean; challenge?: string }>("/auth/login", {
				method: "POST",
				body: JSON.stringify({
					email: String(form.get("email")),
					password: String(form.get("password")),
					// Unchecked: the session ends when the browser closes (shared computers).
					rememberMe: remember,
				}),
			});
			if (result.twoFactorRequired && result.challenge) {
				setChallenge(result.challenge);
				setPending(false);
				return;
			}
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

	async function onVerify(e: React.FormEvent) {
		e.preventDefault();
		setPending(true);
		setError(null);
		try {
			await api("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ challenge, code }) });
		} catch (err) {
			setPending(false);
			setCode("");
			if (err instanceof ApiError && err.code === "CHALLENGE_EXPIRED") {
				setChallenge(null);
				setError(err.message);
				return;
			}
			setError(
				err instanceof ApiError && err.status === 429
					? "Trop de tentatives. Patientez une minute puis réessayez."
					: "Code incorrect.",
			);
			return;
		}
		router.replace(next);
		router.refresh();
	}

	if (challenge) {
		return (
			<form onSubmit={onVerify} className="mt-10 grid gap-6">
				<p className="text-muted-foreground text-center text-sm">
					{useBackup
						? "Saisissez l’un de vos codes de secours. Chaque code ne fonctionne qu’une fois."
						: "Ouvrez votre application d’authentification et saisissez le code à 6 chiffres affiché pour Cabinova."}
				</p>
				<div className="grid gap-2">
					<AuthLabel htmlFor="code">{useBackup ? "Code de secours" : "Code de vérification"}</AuthLabel>
					<Input
						id="code"
						autoFocus
						inputMode={useBackup ? "text" : "numeric"}
						autoComplete="one-time-code"
						maxLength={useBackup ? 20 : 6}
						value={code}
						onChange={(e) => setCode(useBackup ? e.target.value : e.target.value.replace(/\D/g, ""))}
						className={`${authInputClass} text-center font-mono`}
					/>
				</div>
				{error && (
					<p role="alert" className="text-destructive -mt-2 text-sm">
						{error}
					</p>
				)}
				<Button type="submit" disabled={pending || (useBackup ? code.trim().length < 6 : code.length !== 6)} className={authButtonClass}>
					{pending && <LuLoader className="size-4 animate-spin" />}
					Vérifier
				</Button>
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground text-center text-sm underline underline-offset-2"
					onClick={() => {
						setUseBackup((v) => !v);
						setCode("");
						setError(null);
					}}
				>
					{useBackup ? "Utiliser l’application" : "Utiliser un code de secours"}
				</button>
			</form>
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
			<label className="text-muted-foreground flex items-center gap-2.5 text-sm">
				<Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
				Se souvenir de moi
			</label>
			{error && (
				<p role="alert" className="text-destructive -mt-2 text-sm">
					{error}
				</p>
			)}
			<Button type="submit" disabled={pending} className={authButtonClass}>
				{pending && <LuLoader className="size-4 animate-spin" />}
				{pending ? "Connexion…" : "Se connecter"}
			</Button>
			<p className="text-muted-foreground text-center text-sm">
				Pas encore d&apos;accès ? Utilisez le lien d&apos;invitation reçu par e-mail.
			</p>
		</form>
	);
}
