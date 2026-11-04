"use client";

import { useTranslations } from "next-intl";
import { LuCalendarX2, LuTriangleAlert } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** From this many missed appointments, a patient is flagged: confirm their bookings. */
export const NO_SHOW_RISK = 4;

/**
 * "Risque" next to a patient who often misses appointments, wherever the
 * desk books or welcomes them. Nothing below the threshold.
 */
export function NoShowBadge({ count, className }: { count: number | undefined; className?: string }) {
	const t = useTranslations("common.noShowRisk");
	if (!count || count < NO_SHOW_RISK) return null;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Badge variant="destructive" className={cn("cursor-default align-middle", className)} tabIndex={0}>
					<LuCalendarX2 /> {t("label")}
				</Badge>
			</TooltipTrigger>
			<TooltipContent>{t("tooltip", { count })}</TooltipContent>
		</Tooltip>
	);
}

/** Under a chosen patient while booking: why they're flagged, and what to do about it. */
export function NoShowNote({ count }: { count: number | undefined }) {
	const t = useTranslations("common.noShowRisk");
	if (!count || count < NO_SHOW_RISK) return null;
	return (
		<p
			role="note"
			className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
		>
			<LuTriangleAlert className="mt-0.5 size-4 shrink-0" />
			<span>
				<span className="font-semibold">{t("noteTitle", { count })}</span> {t("noteAdvice")}
			</span>
		</p>
	);
}
