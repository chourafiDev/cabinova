"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Locale, LOCALE_NAMES, LOCALES, rememberLocale } from "@/i18n/config";
import { api } from "@/lib/api-client";
import { SettingsCard } from "../../_components/settings-card";

/** The language of this person's interface, kept on their account. */
export function LanguageCard() {
	const router = useRouter();
	const locale = useLocale();
	const t = useTranslations("common.language");
	const [saving, setSaving] = useState(false);

	const change = async (next: string) => {
		setSaving(true);
		try {
			await api("/settings/language", { method: "PUT", body: JSON.stringify({ locale: next }) });
			rememberLocale(next as Locale);
			router.refresh();
			toast.success(t("saved"));
		} catch {
			toast.error(t("error"));
		} finally {
			setSaving(false);
		}
	};

	return (
		<SettingsCard title={t("title")} description={t("description")}>
			<Select value={locale} disabled={saving} onValueChange={change}>
				<SelectTrigger className="w-56" aria-label={t("label")}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{LOCALES.map((l) => (
						<SelectItem key={l} value={l} lang={l}>
							{LOCALE_NAMES[l]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</SettingsCard>
	);
}
