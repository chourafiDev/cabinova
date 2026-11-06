"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { IconMail, IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { AuthLabel, authButtonClass, authInputClass } from "../_components/auth-fields";

export function ForgotPasswordForm() {
	const [sent, setSent] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const t = useTranslations("auth");

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const email = String(new FormData(e.currentTarget).get("email")).trim();
		setPending(true);
		setError(null);
		try {
			await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
			setSent(email);
		} catch (err) {
			setError(err instanceof ApiError && err.status === 429 ? t("forgot.tooMany") : t("forgot.error"));
		} finally {
			setPending(false);
		}
	}

	if (sent) {
		return (
			<div className="mt-10 grid gap-6 text-center">
				<IconMail className="text-primary mx-auto size-8" />
				<p className="text-sm">
					{t.rich("forgot.sent", { email: sent, strong: (chunks) => <strong>{chunks}</strong> })}
				</p>
				<Link href="/login" className="text-sm font-medium hover:underline">
					{t("forgot.back")}
				</Link>
			</div>
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
					autoFocus
					autoComplete="email"
					placeholder={t("emailPlaceholder")}
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
				{pending && <IconSpinner className="size-4 animate-spin" />}
				{t("forgot.submit")}
			</Button>
			<Link href="/login" className="text-muted-foreground hover:text-foreground text-center text-sm">
				{t("forgot.back")}
			</Link>
		</form>
	);
}
