import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type Page = "dashboard" | "appointments" | "patients" | "payments" | "reports" | "staff" | "meetings";
type SettingsPage = "activity" | "tarifs" | "spaces" | "sessions" | "cabinet" | "profile" | "hours" | "integrations";

/** The browser tab of a page, named like its menu entry. */
export async function pageTitle(page: Page): Promise<Metadata> {
	const t = await getTranslations("nav.items");
	return { title: t(page) };
}

export async function settingsTitle(page: SettingsPage): Promise<Metadata> {
	const t = await getTranslations("nav.titles");
	return { title: t("settings", { page: t(page) }) };
}
