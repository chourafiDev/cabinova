"use client";

import { useTranslations } from "next-intl";
import { LuLoader } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adoptLocale } from "@/i18n/config";
import { ApiError, api } from "@/lib/api-client";
import { AuthLabel, authButtonClass, authInputClass } from "../../_components/auth-fields";

const MIN_LENGTH = 8;

export function AcceptInvitationForm({ token, email }: { token: string; email: string }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const t = useTranslations("auth");

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		const password = String(form.get("password"));
		if (password.length < MIN_LENGTH) return setError(t("invite.minLength", { min: MIN_LENGTH }));
		if (password !== form.get("confirm")) return setError(t("invite.mismatch"));

		setPending(true);
		setError(null);
		let loginRequired = false;
		try {
			const result = await api<{ loginRequired?: boolean }>(`/auth/invitations/${encodeURIComponent(token)}/accept`, {
				method: "POST",
				body: JSON.stringify({ password }),
			});
			loginRequired = !!result.loginRequired;
		} catch (err) {
			setPending(false);
			setError(
				err instanceof ApiError && err.status === 429
					? t("invite.tooMany")
					: err instanceof Error
						? err.message
						: t("invite.error"),
			);
			return;
		}
		// A protected account signs in with its code: the link alone isn't enough.
		if (!loginRequired) {
			await adoptLocale((locale) =>
				api("/settings/language", { method: "PUT", body: JSON.stringify({ locale, onlyIfUnset: true }) }),
			);
		}
		router.replace(loginRequired ? "/login" : "/");
		router.refresh();
	}

	return (
		<form onSubmit={onSubmit} className="mt-10 grid gap-6">
			{/* Lets password managers save the login with the right e-mail. */}
			<Input type="email" value={email} readOnly autoComplete="username" className={authInputClass} />
			<div className="grid gap-2">
				<AuthLabel htmlFor="password">{t("password")}</AuthLabel>
				<PasswordInput
					id="password"
					name="password"
					autoComplete="new-password"
					placeholder={t("invite.minLength", { min: MIN_LENGTH })}
					required
					minLength={MIN_LENGTH}
					className={authInputClass}
				/>
			</div>
			<div className="grid gap-2">
				<AuthLabel htmlFor="confirm">{t("invite.confirm")}</AuthLabel>
				<PasswordInput
					id="confirm"
					name="confirm"
					autoComplete="new-password"
					placeholder={t("invite.confirmPlaceholder")}
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
				{pending ? t("invite.pending") : t("invite.submit")}
			</Button>
		</form>
	);
}
