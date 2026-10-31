"use client";

import { useTranslations } from "next-intl";
import { LuLoader } from "react-icons/lu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { adoptLocale } from "@/i18n/config";
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
	const t = useTranslations("auth");
	const signedIn = async () => {
		await adoptLocale((locale) =>
			api("/settings/language", { method: "PUT", body: JSON.stringify({ locale, onlyIfUnset: true }) }),
		);
		router.replace(next);
		router.refresh();
	};

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
			setError(err instanceof ApiError && err.status === 429 ? t("login.tooMany") : t("login.invalid"));
			return;
		}
		await signedIn();
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
				setError(t("twoFactor.expired"));
				return;
			}
			setError(err instanceof ApiError && err.status === 429 ? t("login.tooMany") : t("twoFactor.invalid"));
			return;
		}
		await signedIn();
	}

	if (challenge) {
		return (
			<form onSubmit={onVerify} className="mt-10 grid gap-6">
				<p className="text-muted-foreground text-center text-sm">
					{useBackup ? t("twoFactor.backup") : t("twoFactor.app")}
				</p>
				<div className="grid gap-2">
					<AuthLabel htmlFor="code">{useBackup ? t("twoFactor.backupLabel") : t("twoFactor.codeLabel")}</AuthLabel>
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
					{t("twoFactor.verify")}
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
					{useBackup ? t("twoFactor.useApp") : t("twoFactor.useBackup")}
				</button>
			</form>
		);
	}

	return (
		<form onSubmit={onSubmit} className="mt-10 grid gap-6">
			<div className="grid gap-2">
				<AuthLabel htmlFor="email">{t("email")}</AuthLabel>
				<Input
					id="email"
					name="email"
					type="email"
					autoComplete="email"
					placeholder={t("emailPlaceholder")}
					required
					className={authInputClass}
				/>
			</div>
			<div className="grid gap-2">
				<div className="flex items-baseline justify-between gap-3">
					<AuthLabel htmlFor="password">{t("password")}</AuthLabel>
					<Link href="/forgot-password" className="text-muted-foreground hover:text-foreground text-sm">
						{t("login.forgot")}
					</Link>
				</div>
				<PasswordInput
					id="password"
					name="password"
					autoComplete="current-password"
					placeholder={t("passwordPlaceholder")}
					required
					className={authInputClass}
				/>
			</div>
			<label className="text-muted-foreground flex items-center gap-2.5 text-sm">
				<Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
				{t("login.remember")}
			</label>
			{error && (
				<p role="alert" className="text-destructive -mt-2 text-sm">
					{error}
				</p>
			)}
			<Button type="submit" disabled={pending} className={authButtonClass}>
				{pending && <LuLoader className="size-4 animate-spin" />}
				{pending ? t("login.pending") : t("login.submit")}
			</Button>
			<p className="text-muted-foreground text-center text-sm">
				{t("login.noAccess")}
			</p>
		</form>
	);
}
