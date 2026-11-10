import { useTranslations } from "next-intl";
import { IconSupport } from "@/components/icons";
import { Button } from "@/components/ui/button";

/** Support card at the bottom of the sidebar; hidden when collapsed to icons. */
export function HelpCard() {
	const t = useTranslations("common.help");
	return (
		<div className="group-data-[collapsible=icon]:hidden rounded-xl bg-brand p-3">
			<div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-white/15 text-white">
				<IconSupport className="size-4" />
			</div>
			<p className="text-sm font-medium text-white">{t("title")}</p>
			<p className="mt-0.5 text-xs text-white/70">{t("description")}</p>
			<Button asChild size="sm" variant="outline" className="mt-3 w-full bg-sidebar">
				<a href="mailto:support@cabinova.ma">{t("action")}</a>
			</Button>
		</div>
	);
}
