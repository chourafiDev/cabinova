"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DateRange } from "react-day-picker";
import { IconCalendarRange, IconCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { DASHBOARD_PRESETS, DEFAULT_DASHBOARD_PRESET, type DashboardPreset } from "@/lib/dashboard";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

const ALL = "tous";
const day = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Period (7 days … 1 year, or two dates) and, for the owner of several spaces, which space. */
export function DashboardFilters({
	preset,
	period,
	space,
}: {
	/** null: a custom range. */
	preset: DashboardPreset | null;
	period: { from: string; to: string };
	/** The owner's space choice; absent with a single space. */
	space?: { label: string; all: boolean };
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [range, setRange] = useState<DateRange | undefined>();
	const [open, setOpen] = useState(false);
	const mobile = useIsMobile();
	const t = useTranslations("dashboard.filters");
	const format = useFormat();

	/** The current filters with these changes, as a URL (defaults left out). */
	const go = (changes: Record<string, string | null>) => {
		const params = new URLSearchParams();
		if (preset === null) {
			params.set("du", period.from);
			params.set("au", period.to);
		} else if (preset !== DEFAULT_DASHBOARD_PRESET) params.set("periode", preset);
		if (space?.all) params.set("espaces", ALL);
		for (const [k, v] of Object.entries(changes)) {
			if (v === null) params.delete(k);
			else params.set(k, v);
		}
		const qs = params.toString();
		startTransition(() => router.push(qs ? `/?${qs}` : "/", { scroll: false }));
	};
	const applyRange = () => {
		if (!range?.from) return;
		go({ periode: null, du: day(range.from), au: day(range.to ?? range.from) });
		setOpen(false);
	};

	return (
		<div
			aria-busy={pending}
			className={cn("mb-3 flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}
		>
			<div className="bg-muted flex rounded-lg p-0.5 text-sm" role="group" aria-label={t("period")}>
				{DASHBOARD_PRESETS.map((p) => (
					<button
						key={p.key}
						type="button"
						aria-pressed={preset === p.key}
						onClick={() => go({ periode: p.key === DEFAULT_DASHBOARD_PRESET ? null : p.key, du: null, au: null })}
						className={cn(
							"rounded-md px-3 py-1 whitespace-nowrap transition-colors",
							preset === p.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
						)}
					>
						{t(p.key)}
					</button>
				))}
			</div>

			<Popover
				open={open}
				onOpenChange={(o) => {
					setOpen(o);
					if (o) setRange({ from: new Date(`${period.from}T12:00:00`), to: new Date(`${period.to}T12:00:00`) });
				}}
			>
				<PopoverTrigger asChild>
					<Button variant={preset === null ? "secondary" : "outline"} size="sm" className="h-8">
						<IconCalendarRange />
						{preset === null ? format.period(period.from, period.to) : t("custom")}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-auto p-0">
					<Calendar
						mode="range"
						resetOnSelect
						numberOfMonths={mobile ? 1 : 2}
						selected={range}
						onSelect={setRange}
						defaultMonth={range?.from}
						disabled={{ after: new Date() }}
						max={366}
					/>
					<div className="flex items-center justify-between gap-3 border-t p-3">
						<span className="text-muted-foreground text-xs">
							{range?.from ? format.period(day(range.from), day(range.to ?? range.from)) : t("pickDates")}
						</span>
						<Button size="sm" disabled={!range?.from} onClick={applyRange}>
							<IconCheck /> {t("apply")}
						</Button>
					</div>
				</PopoverContent>
			</Popover>

			{space && (
				<Select value={space.all ? ALL : "current"} onValueChange={(v) => go({ espaces: v === ALL ? ALL : null })}>
					<SelectTrigger size="sm" className="w-auto min-w-40" aria-label={t("space")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="current">{space.label}</SelectItem>
						<SelectItem value={ALL}>{t("allSpaces")}</SelectItem>
					</SelectContent>
				</Select>
			)}
		</div>
	);
}
