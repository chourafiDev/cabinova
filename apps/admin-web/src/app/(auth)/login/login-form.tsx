"use client";

import { LuArrowLeft, LuLoader, LuShieldCheck } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { AuthLabel, authButtonClass, authInputClass } from "../_components/auth-fields";

export function LoginForm({ next }: { next: string }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [remember, setRemember] = useState(true);
	/** Set when the password was right and the account has 2FA. */
	const [challenge, setChallenge] = useState<string | null>(null);
	const [useBackup, setUseBackup] = useState(false);
	const [code, setCode] = useState("");

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		setPending(true);
		setError(null);

		try {
			const result = await api<{ ok?: true; twoFactorRequired?: true; challenge?: string }>("/auth/login", {
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

	async function onVerify(e: React.FormEvent<HTMLFormElement>) {
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
			const left = err instanceof ApiError ? (err.details.attemptsLeft as number | undefined) : undefined;
			setError(
				err instanceof ApiError && err.status === 429
					? "Trop de tentatives. Patientez une minute."
					: `Code incorrect.${left ? ` ${left} essai${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}.` : ""}`,
			);
			return;
		}
		router.replace(next);
		router.refresh();
	}

	if (challenge) {
		return (
			<form onSubmit={onVerify} className="mt-10 grid gap-6">
				<div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
					<LuShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
					<p>
						{useBackup
							? "Saisissez l’un de vos codes de secours. Chaque code ne fonctionne qu’une fois."
							: "Ouvrez votre application d’authentification et saisissez le code à 6 chiffres affiché pour Cabinova."}
					</p>
				</div>
				<div className="grid gap-2">
					<AuthLabel htmlFor="code">{useBackup ? "Code de secours" : "Code de vérification"}</AuthLabel>
					<Input
						id="code"
						name="code"
						autoFocus
						required
						autoComplete="one-time-code"
						inputMode={useBackup ? "text" : "numeric"}
						maxLength={useBackup ? 11 : 6}
						placeholder={useBackup ? "xxxxx-xxxxx" : "123456"}
						value={code}
						onChange={(e) => setCode(useBackup ? e.target.value : e.target.value.replace(/\D/g, ""))}
						className={cn(authInputClass, "text-center font-mono text-lg tracking-[0.3em]")}
					/>
				</div>
				{error && (
					<p role="alert" className="text-destructive -mt-2 text-sm">
						{error}
					</p>
				)}
				<Button type="submit" disabled={pending || (!useBackup && code.length !== 6)} className={authButtonClass}>
					{pending && <LuLoader className="size-4 animate-spin" />}
					{pending ? "Vérification…" : "Valider"}
				</Button>
				<div className="flex items-center justify-between text-sm">
					<button
						type="button"
						className="text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
						onClick={() => {
							setChallenge(null);
							setCode("");
							setError(null);
						}}
					>
						<LuArrowLeft className="size-3.5" /> Retour
					</button>
					<button
						type="button"
						className="font-medium hover:underline"
						onClick={() => {
							setUseBackup((b) => !b);
							setCode("");
							setError(null);
						}}
					>
						{useBackup ? "Utiliser l’application" : "Utiliser un code de secours"}
					</button>
				</div>
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
				{pending && <LuLoader className="size-4 animate-spin" />}
				{pending ? "Connexion…" : "Se connecter"}
			</Button>
			<p className="text-muted-foreground text-center text-sm">
				Pas encore d&apos;accès ?{" "}
				<span className="text-foreground">Demandez une invitation au Super Admin.</span>
			</p>
		</form>
	);
}
