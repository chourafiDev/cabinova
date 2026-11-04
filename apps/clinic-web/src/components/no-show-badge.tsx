"use client";

import { useTranslations } from "next-intl";
import { LuCalendarX2 } from "react-icons/lu";
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
