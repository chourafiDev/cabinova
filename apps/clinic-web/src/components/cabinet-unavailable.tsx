import { useLocale, useTranslations } from "next-intl";
import { IconBuilding, IconClock, IconLock, IconPlug, IconRefresh } from "@/components/icons";
import { translateError } from "@/lib/api-errors";
import type { Unavailable } from "@/lib/server-api";

const ICONS: Record<string, typeof IconBuilding> = {
	TENANT_NOT_READY: IconClock,
	TENANT_SUSPENDED: IconLock,
	SERVICE_UNAVAILABLE: IconPlug,
	TENANT_OUTDATED: IconRefresh,
};

/** Full page when this address can't be used: unknown cabinet, not ready, suspended, API down. */
export function CabinetUnavailable({ reason }: { reason: Unavailable }) {
	const t = useTranslations("common");
	const locale = useLocale();
	const Icon = ICONS[reason.code] ?? IconBuilding;
	return (
		<main className="flex min-h-screen items-center justify-center bg-background p-6">
			<div className="flex max-w-sm flex-col items-center gap-3 text-center">
				<span className="flex size-12 items-center justify-center rounded-xl bg-muted">
					<Icon className="size-5 text-muted-foreground" />
				</span>
				<h1 className="text-lg font-semibold">{t(`unavailable.${reason.code in ICONS ? reason.code : "default"}`)}</h1>
				<p className="text-sm text-muted-foreground">{translateError(reason, locale)}</p>
				<a href="mailto:support@cabinova.ma" className="text-sm font-medium hover:underline">
					{t("support")}
				</a>
			</div>
		</main>
	);
}
