"use client";

import { useTranslations } from "next-intl";
import { LuFlag } from "react-icons/lu";
import { holidayOf } from "@/calendar/helpers";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** A public holiday's name on its day in the agenda; religious ones say their date is estimated. */
export function HolidayLabel({ date, className }: { date: Date; className?: string }) {
	const t = useTranslations("common.holidays");
	const holiday = holidayOf(date);
	if (!holiday) return null;
	const name = t(`names.${holiday.key}`);
	const label = (
		<span
			// The full name when a narrow column cuts it.
			title={holiday.estimated ? undefined : name}
			tabIndex={holiday.estimated ? 0 : undefined}
			className={cn(
				"inline-flex max-w-full items-center gap-1 truncate rounded-sm bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300",
				className,
			)}
		>
			<LuFlag className="size-3 shrink-0" />
			<span className="truncate">{name}</span>
		</span>
	);
	if (!holiday.estimated) return label;
	return (
		<Tooltip>
			<TooltipTrigger asChild>{label}</TooltipTrigger>
			<TooltipContent>
				{name} · {t("estimated")}
			</TooltipContent>
		</Tooltip>
	);
}
