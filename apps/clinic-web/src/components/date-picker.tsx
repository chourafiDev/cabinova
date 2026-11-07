"use client";

import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { arMA, fr } from "react-day-picker/locale";
import { IconCalendar } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/** "YYYY-MM-DD" → a Date at noon (no time zone shifts the day). */
const toDate = (day: string) => new Date(`${day}T12:00:00`);

/**
 * A day, picked on the app's calendar (shadcn) rather than the browser's.
 * Same value as `<input type="date">`: "YYYY-MM-DD", or "" when empty.
 * `years` adds month and year menus, for dates far from today (birth dates);
 * `clearable` offers to empty an optional date.
 */
export function DatePicker({
	id,
	value,
	onChange,
	min,
	max,
	years = false,
	clearable = false,
	invalid,
	disabled,
	placeholder,
	className,
}: {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	min?: string;
	max?: string;
	years?: boolean;
	clearable?: boolean;
	invalid?: boolean;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
}) {
	const t = useTranslations("common.datePicker");
	const fmt = useFormat();
	const ar = useLocale() === "ar";
	const [open, setOpen] = useState(false);
	const selected = value ? toDate(value) : undefined;
	const first = min ? toDate(min) : undefined;
	const last = max ? toDate(max) : undefined;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					disabled={disabled}
					aria-invalid={invalid}
					className={cn(
						"bg-background h-9 w-full justify-start px-3 font-normal",
						!value && "text-muted-foreground",
						className,
					)}
				>
					<IconCalendar className="text-muted-foreground" />
					<span className="truncate first-letter:uppercase">
						{selected
							? fmt.date(selected, { weekday: "short", day: "numeric", month: "long", year: "numeric" })
							: (placeholder ?? t("placeholder"))}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Calendar
					mode="single"
					locale={ar ? arMA : fr}
					dir={ar ? "rtl" : "ltr"}
					selected={selected}
					defaultMonth={selected ?? last ?? first}
					onSelect={(day) => {
						// Clicking the chosen day again empties it only where a date is optional.
						if (day) onChange(format(day, "yyyy-MM-dd"));
						else if (clearable) onChange("");
						setOpen(false);
					}}
					disabled={[...(first ? [{ before: first }] : []), ...(last ? [{ after: last }] : [])]}
					captionLayout={years ? "dropdown" : "label"}
					startMonth={first ?? (years ? new Date(1900, 0) : undefined)}
					endMonth={last ?? (years ? new Date(new Date().getFullYear() + 5, 11) : undefined)}
				/>
				{clearable && value && !disabled && (
					<div className="border-t p-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-muted-foreground w-full"
							onClick={() => {
								onChange("");
								setOpen(false);
							}}
						>
							{t("clear")}
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
