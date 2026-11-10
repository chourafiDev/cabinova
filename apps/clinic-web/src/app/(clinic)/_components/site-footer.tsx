import { useTranslations } from "next-intl";

export function SiteFooter() {
	const t = useTranslations("common");
	return (
		<footer className="text-muted-foreground text-center border-t px-4 py-3 text-xs">
			<p>{t("footer")}</p>
		</footer>
	);
}
