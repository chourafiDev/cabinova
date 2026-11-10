"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { IconEye, IconEyeOff, IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import { SettingsCard } from "../../_components/settings-card";

const EMPTY = { current: "", next: "", confirm: "" };
type Errors = Partial<Record<keyof typeof EMPTY, string>>;

/** Changing the password signs out every other device (done by the API). */
export function PasswordForm() {
	const router = useRouter();
	const [v, setV] = useState(EMPTY);
	const [errors, setErrors] = useState<Errors>({});
	const [visible, setVisible] = useState(false);
	const [saving, setSaving] = useState(false);
	const complete = v.current && v.next && v.confirm;
	const t = useTranslations("settings.password");

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		const next: Errors = {};
		if (v.next.length < 8) next.next = t("tooShort");
		else if (v.next === v.current) next.next = t("same");
		if (v.confirm !== v.next) next.confirm = t("mismatch");
		setErrors(next);
		if (Object.keys(next).length) return;

		setSaving(true);
		try {
			await api("/settings/password", {
				method: "PUT",
				body: JSON.stringify({ currentPassword: v.current, newPassword: v.next }),
			});
			setV(EMPTY);
			toast.success(t("changed"), { description: t("changedHint") });
			router.refresh();
		} catch (err) {
			if (err instanceof ApiError && err.code === "WRONG_PASSWORD") setErrors({ current: err.message });
			else toast.error(err instanceof Error ? err.message : t("error"));
		} finally {
			setSaving(false);
		}
	};

	const field = (key: keyof typeof EMPTY, label: string, autoComplete: string, hint?: string) => (
		<Field data-invalid={!!errors[key]}>
			<FieldLabel htmlFor={`password-${key}`}>{label}</FieldLabel>
			<Input
				id={`password-${key}`}
				type={visible ? "text" : "password"}
				autoComplete={autoComplete}
				value={v[key]}
				aria-invalid={!!errors[key]}
				onChange={(e) => {
					setV({ ...v, [key]: e.target.value });
					if (errors[key]) setErrors({ ...errors, [key]: undefined });
				}}
			/>
			{errors[key] ? <FieldError>{errors[key]}</FieldError> : hint && <FieldDescription>{hint}</FieldDescription>}
		</Field>
	);

	return (
		<form onSubmit={save} noValidate>
			<SettingsCard
				title={t("title")}
				description={t("description")}
				action={
					<Button type="button" variant="ghost" size="sm" onClick={() => setVisible((x) => !x)}>
						{visible ? <IconEyeOff /> : <IconEye />} {visible ? t("hide") : t("show")}
					</Button>
				}
				footer={
					<>
						<p className="text-muted-foreground text-xs">{t("hint")}</p>
						<Button type="submit" size="sm" disabled={!complete || saving}>
							{saving && <IconSpinner className="animate-spin" />} {t("submit")}
						</Button>
					</>
				}
			>
				<div className="grid gap-4">
					<div className="sm:max-w-[calc(50%-0.5rem)]">{field("current", t("current"), "current-password")}</div>
					<div className="grid gap-4 sm:grid-cols-2">
						{field("next", t("next"), "new-password")}
						{field("confirm", t("confirm"), "new-password")}
					</div>
				</div>
			</SettingsCard>
		</form>
	);
}
