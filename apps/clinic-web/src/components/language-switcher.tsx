"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LOCALE_NAMES, LOCALES, rememberLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Sign-in pages: nobody is known yet, so the choice lives in a cookie. */
export function LanguageSwitcher({ className }: { className?: string }) {
	const router = useRouter();
	const current = useLocale();
	const t = useTranslations("common.language");
	return (
		<nav aria-label={t("switcher")} className={cn("flex justify-center gap-3 text-sm", className)}>
			{LOCALES.map((locale) => (
				<button
					key={locale}
					type="button"
					lang={locale}
					aria-current={locale === current ? "true" : undefined}
					className={cn("text-muted-foreground hover:text-foreground", locale === current && "text-foreground font-medium")}
					onClick={() => {
						rememberLocale(locale);
						router.refresh();
					}}
				>
					{LOCALE_NAMES[locale]}
				</button>
			))}
		</nav>
	);
}
