import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconCompass } from "@/components/icons";
import { Button } from "@/components/ui/button";

/** Shown for an address that doesn't exist, inside or outside the app frame. */
export function NotFoundView() {
	const t = useTranslations("common.notFound");
	return (
		<div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
			<span className="bg-muted flex size-12 items-center justify-center rounded-xl">
				<IconCompass className="text-muted-foreground size-5" />
			</span>
			<h1 className="text-lg font-semibold">{t("title")}</h1>
			<p className="text-muted-foreground max-w-sm text-sm">{t("message")}</p>
			<Button asChild variant="outline" size="sm">
				<Link href="/">{t("back")}</Link>
			</Button>
		</div>
	);
}
