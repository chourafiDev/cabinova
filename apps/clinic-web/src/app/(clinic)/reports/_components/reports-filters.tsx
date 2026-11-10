"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { IconCalendarRange, IconCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { DEFAULT_PRESET, PRESETS, type PresetKey, type Report } from "@/lib/reports";
import { spaceLabel } from "@/lib/spaces";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { useReportsNavigate } from "./reports-shell";

const ALL = "all";
const day = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** One row above everything: period first, then space and doctor. */
export function ReportsFilters({
	preset,
	report,
	userId,
}: {
	/** null: a custom range. */
	preset: PresetKey | null;
	report: Report;
	userId: string;
}) {
	const navigate = useReportsNavigate();
	const { period, filters } = report;
	const [range, setRange] = useState<DateRange | undefined>();
	const [open, setOpen] = useState(false);
	const mobile = useIsMobile();
	const t = useTranslations("reports.filters");
	const format = useFormat();
	const periodLabel = format.period;

	/** The current filters with these changes, as a URL (defaults left out). */
	const href = (changes: Record<string, string | null>) => {
		const params = new URLSearchParams();
		if (preset === null) {
			params.set("du", period.from);
			params.set("au", period.to);
		} else if (preset !== DEFAULT_PRESET) params.set("periode", preset);
		if (filters.space) params.set("espace", filters.space);
		if (filters.practitioner) params.set("medecin", filters.practitioner);
		for (const [k, v] of Object.entries(changes)) {
			if (v === null) params.delete(k);
			else params.set(k, v);
		}
		const qs = params.toString();
		return qs ? `/reports?${qs}` : "/reports";
	};
	const choosePreset = (key: PresetKey) =>
		navigate(href({ periode: key === DEFAULT_PRESET ? null : key, du: null, au: null }));
	const applyRange = () => {
		if (!range?.from) return;
		navigate(href({ periode: null, du: day(range.from), au: day(range.to ?? range.from) }));
		setOpen(false);
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="bg-muted flex rounded-lg p-0.5 text-sm" role="group" aria-label={t("period")}>
				{PRESETS.map((p) => (
					<button
						key={p.key}
						type="button"
						aria-pressed={preset === p.key}
						onClick={() => choosePreset(p.key)}
						className={cn(
							"rounded-md px-3 py-1 whitespace-nowrap transition-colors",
							preset === p.key
								? "bg-background font-medium shadow-sm"
								: "text-muted-foreground hover:text-foreground",
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
						{preset === null ? periodLabel(period.from, period.to) : t("custom")}
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
							{range?.from ? periodLabel(day(range.from), day(range.to ?? range.from)) : t("pickDates")}
						</span>
						<Button size="sm" disabled={!range?.from} onClick={applyRange}>
							<IconCheck /> {t("apply")}
						</Button>
					</div>
				</PopoverContent>
			</Popover>

			{filters.spaces.length > 1 && (
				<Select value={filters.space ?? ALL} onValueChange={(v) => navigate(href({ espace: v === ALL ? null : v }))}>
					<SelectTrigger size="sm" className="w-auto min-w-40" aria-label={t("space")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>{t("allSpaces")}</SelectItem>
						{filters.spaces.map((s) => (
							<SelectItem key={s.id} value={s.id}>
								{spaceLabel(s)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}

			{filters.practitioners ? (
				filters.practitioners.length > 1 && (
					<Select
						value={filters.practitioner ?? ALL}
						onValueChange={(v) => navigate(href({ medecin: v === ALL ? null : v }))}
					>
						<SelectTrigger size="sm" className="w-auto min-w-40" aria-label={t("doctor")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>{t("allDoctors")}</SelectItem>
							{filters.practitioners.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.id === userId ? t("you", { name: p.name }) : p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)
			) : (
				<Select
					value={filters.practitioner ? "mine" : ALL}
					onValueChange={(v) => navigate(href({ medecin: v === ALL ? null : userId }))}
				>
					<SelectTrigger size="sm" className="w-auto min-w-40" aria-label={t("appointments")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>{t("wholeCabinet")}</SelectItem>
						<SelectItem value="mine">{t("mine")}</SelectItem>
					</SelectContent>
				</Select>
			)}

		</div>
	);
}
