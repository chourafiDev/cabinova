"use client";

import { useTranslations } from "next-intl";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import { holidayOf } from "@/calendar/helpers";
import { IconFlag } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KIND_ICONS } from "@/lib/closures";
import { cn } from "@/lib/utils";

/**
 * A public holiday's name on its day in the agenda: red when it closes the
 * cabinet, muted when the cabinet works it. Religious ones say their date is estimated.
 */
export function HolidayLabel({ date, className }: { date: Date; className?: string }) {
	const t = useTranslations("common.holidays");
	const { holidayOn } = useCalendar();
	const holiday = holidayOf(date);
	if (!holiday) return null;
	const worked = !holidayOn(date);
	const name = t(`names.${holiday.key}`);
	const full = [name, worked && t("worked"), holiday.estimated && t("estimated")].filter(Boolean).join(" · ");
	const label = (
		<span
			// The full name when a narrow column cuts it.
			title={holiday.estimated ? undefined : full}
			tabIndex={holiday.estimated ? 0 : undefined}
			className={cn(
				"inline-flex max-w-full items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
				worked ? "bg-muted text-muted-foreground" : "bg-red-50 text-red-700",
				className,
			)}
		>
			<IconFlag className="size-3 shrink-0" />
			<span className="truncate">{name}</span>
		</span>
	);
	if (!holiday.estimated) return label;
	return (
		<Tooltip>
			<TooltipTrigger asChild>{label}</TooltipTrigger>
			<TooltipContent>{full}</TooltipContent>
		</Tooltip>
	);
}

/**
 * Everything closing a day, above it in the agenda: the public holiday, the
 * cabinet's closure, the doctors' absences ("Dr Alaoui · Congé").
 */
export function DayLabels({ date, className }: { date: Date; className?: string }) {
	const { closuresOn } = useCalendar();
	const t = useTranslations("absences");
	const closures = closuresOn(date);
	return (
		<>
			<HolidayLabel date={date} className={className} />
			{closures.map((c) => {
				const Icon = KIND_ICONS[c.kind];
				const text = `${c.practitionerName ?? t("closed")} · ${t(`kinds.${c.kind}`)}`;
				return (
					<span
						key={c.id}
						title={text}
						className={cn(
							"inline-flex max-w-full items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
							c.practitionerId
								? "bg-sky-50 text-sky-800"
								: "bg-red-50 text-red-700",
							className,
						)}
					>
						<Icon className="size-3 shrink-0" />
						<span className="truncate">{text}</span>
					</span>
				);
			})}
		</>
	);
}
