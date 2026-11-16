"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { IconSearch } from "@/components/icons";
import { ChartContainer } from "@/components/ui/chart";
import {
	byCatalogOrder,
	foldLab,
	LAB_CATALOG,
	type LabResult,
	labNumeric,
} from "@/lib/lab-results";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;
/** "2026-11-15" → its noon, so a day never slips across a time zone. */
const at = (day: string) => new Date(`${day}T12:00:00`).getTime();

type Point = { time: number; day: string; value: number; raw: string };
type Series = {
	name: string;
	unit: string | null;
	group: string;
	points: Point[];
};
type Period = "all" | "year" | "half";

const GROUP_OF = new Map(
	LAB_CATALOG.flatMap((g) => g.tests.map((t) => [t.name, g.group] as const)),
);
const GROUP_ORDER = new Map(LAB_CATALOG.map((g, i) => [g.group, i]));

/** "12.5" → "12,5" (French decimals), at most 2 digits after the comma. */
const fr = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * Round ticks for the value axis ("0, 50, 100", not "1,8, 41,8, 81,8"):
 * the data range widened to a 1, 2, 2.5 or 5 step.
 */
function niceAxis(min: number, max: number, count = 4) {
	if (min === max) {
		const pad = Math.abs(min) * 0.1 || 1;
		min -= pad;
		max += pad;
	}
	const raw = (max - min) / count;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step =
		[1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ??
		10 * magnitude;
	const lo = Math.floor(min / step) * step;
	const hi = Math.ceil(max / step) * step;
	const ticks: number[] = [];
	for (let v = lo; v <= hi + step / 2; v += step)
		ticks.push(Math.round(v * 1e6) / 1e6);
	return { domain: [lo, hi] as [number, number], ticks };
}

/** How the last value moved since the one before: up, down or the same, with the gap. */
function change(points: Point[]) {
	const last = points.at(-1);
	const before = points.at(-2);
	if (!last || !before) return null;
	const diff = last.value - before.value;
	const pct = before.value !== 0 ? (diff / Math.abs(before.value)) * 100 : null;
	return {
		diff,
		pct,
		before,
		direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
	} as const;
}

/**
 * The results as curves, made to stay readable with many tests: a list on
 * the side (grouped as on a lab report, searchable, each with its last
 * value, its trend and a small curve), and one large chart for the test
 * picked — over a period, with its values in a table. Tests whose values
 * aren't numbers ("Négatif") are named apart, since they can't be drawn.
 */
export function BilanCharts({ results }: { results: LabResult[] }) {
	const t = useTranslations("dossier.bilan.charts");
	const [search, setSearch] = useState("");
	const [picked, setPicked] = useState<string | null>(null);

	const byName = new Map<string, LabResult[]>();
	for (const r of results)
		byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
	const series: Series[] = [];
	const notPlotted: string[] = [];
	for (const name of [...byName.keys()].sort(byCatalogOrder)) {
		const list = byName.get(name)!;
		// One value per day (the latest written), oldest first.
		const perDay = new Map<string, Point>();
		for (const r of list.toSorted((a, b) =>
			a.createdAt.localeCompare(b.createdAt),
		)) {
			const value = labNumeric(r.value);
			if (value !== null)
				perDay.set(r.takenOn, {
					time: at(r.takenOn),
					day: r.takenOn,
					value,
					raw: r.value,
				});
		}
		const points = [...perDay.values()].sort((a, b) => a.time - b.time);
		if (points.length)
			series.push({
				name,
				unit: list[0].unit,
				group: GROUP_OF.get(name) ?? t("other"),
				points,
			});
		else notPlotted.push(name);
	}

	if (!series.length) {
		return (
			<p className="text-muted-foreground rounded-2xl border p-10 text-center text-sm">
				{t("none")}
			</p>
		);
	}

	// The test shown: the one picked, else the most followed (most measures, then the latest).
	const fallback = series.toSorted(
		(a, b) =>
			b.points.length - a.points.length ||
			b.points.at(-1)!.time - a.points.at(-1)!.time,
	)[0];
	const current = series.find((s) => s.name === picked) ?? fallback;

	const q = foldLab(search.trim());
	const shown = series.filter(
		(s) => !q || foldLab(`${s.name} ${s.group}`).includes(q),
	);
	const groups = [...new Set(shown.map((s) => s.group))].sort(
		(a, b) => (GROUP_ORDER.get(a) ?? 99) - (GROUP_ORDER.get(b) ?? 99),
	);

	return (
		<div className="bg-card grid overflow-hidden rounded-2xl border md:grid-cols-[17rem_minmax(0,1fr)]">
			<aside className="flex min-h-0 flex-col border-b md:max-h-[36rem] md:border-e md:border-b-0">
				<div className="border-b p-3">
					<div className="relative">
						<IconSearch className="text-muted-foreground/70 pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
						<input
							type="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("search")}
							aria-label={t("search")}
							className="bg-muted/50 focus:ring-highlight/40 placeholder:text-muted-foreground/60 h-9 w-full rounded-lg ps-8 pe-2 text-sm outline-none focus:ring-2"
						/>
					</div>
					<p className="text-muted-foreground/70 mt-2 px-0.5 text-[11px]">
						{t("count", { count: series.length })}
					</p>
				</div>
				<nav
					className="min-h-0 flex-1 overflow-y-auto p-1.5"
					aria-label={t("list")}
				>
					{shown.length === 0 && (
						<p className="text-muted-foreground p-4 text-center text-xs">
							{t("noMatch")}
						</p>
					)}
					{groups.map((group) => (
						<div key={group} className="mb-1">
							<p className="text-muted-foreground/70 px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase">
								{group}
							</p>
							<ul>
								{shown
									.filter((s) => s.group === group)
									.map((s) => (
										<li key={s.name}>
											<TestRow
												series={s}
												active={s.name === current.name}
												onPick={() => setPicked(s.name)}
											/>
										</li>
									))}
							</ul>
						</div>
					))}
					{notPlotted.length > 0 && (
						<p className="text-muted-foreground/70 border-t px-2.5 pt-2.5 pb-1.5 text-[11px] leading-relaxed">
							{t("notPlotted", { names: notPlotted.join(", ") })}
						</p>
					)}
				</nav>
			</aside>
			<TestDetail key={current.name} series={current} />
		</div>
	);
}

/** One test in the list: its name, last value, trend, and a small curve of its values. */
function TestRow({
	series,
	active,
	onPick,
}: {
	series: Series;
	active: boolean;
	onPick: () => void;
}) {
	const t = useTranslations("dossier.bilan.charts");
	const last = series.points.at(-1)!;
	const moved = change(series.points);
	return (
		<button
			type="button"
			onClick={onPick}
			aria-current={active || undefined}
			className={cn(
				"focus-visible:ring-highlight/50 relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none",
				active ? "bg-highlight" : "hover:bg-muted/60",
			)}
		>
			{/* {active && <span className="bg-highlight absolute inset-y-2 start-0 w-0.5 rounded-full" />} */}
			<span className="grid min-w-0 flex-1">
				<span
					className={cn(
						"truncate text-sm",
						active ? "font-semibold text-white" : "font-medium",
					)}
				>
					{series.name}
				</span>
				<span className={cn("text-[11px]", active && "text-white")}>
					{t("points", { count: series.points.length })}
					{series.unit && ` · ${series.unit}`}
				</span>
			</span>
			<Sparkline points={series.points} active={active} />
			<span
				className="flex w-14 shrink-0 items-baseline justify-end gap-0.5 tabular-nums"
				dir="ltr"
			>
				<span className={cn("text-sm font-semibold", active && "text-white")}>
					{last.raw}
				</span>
				{moved && moved.direction !== "flat" && (
					<span
						className={cn(
							"text-[11px] font-bold",
							moved.direction === "up" ? "text-amber-600" : "text-sky-600",
						)}
						aria-label={t(moved.direction === "up" ? "up" : "down")}
					>
						{moved.direction === "up" ? "↑" : "↓"}
					</span>
				)}
			</span>
		</button>
	);
}

/** The shape of a test's values, at a glance (nothing for a single measure). */
function Sparkline({ points, active }: { points: Point[]; active: boolean }) {
	if (points.length < 2) return <span className="w-12 shrink-0" aria-hidden />;
	const values = points.map((p) => p.value);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const first = points[0].time;
	const width = points.at(-1)!.time - first || 1;
	const path = points
		.map(
			(p) =>
				`${(((p.time - first) / width) * 46 + 1).toFixed(1)},${(17 - ((p.value - min) / span) * 14).toFixed(1)}`,
		)
		.join(" ");
	return (
		<svg
			viewBox="0 0 48 18"
			className={cn(
				"h-[18px] w-12 shrink-0 [direction:ltr]",
				active ? "text-white" : "text-highlight",
			)}
			aria-hidden
		>
			<polyline
				points={path}
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** The test picked: its last value and how it moved, its curve over a period, its values. */
function TestDetail({ series }: { series: Series }) {
	const t = useTranslations("dossier.bilan.charts");
	const format = useFormat();
	const gradient = `bilan-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const [period, setPeriod] = useState<Period>("all");
	const { points: all, unit } = series;
	const last = all.at(-1)!;
	const moved = change(all);

	// Periods only when the values span them.
	const span = last.time - all[0].time;
	const periods: Period[] = [
		"all",
		...(span > 365 * DAY ? (["year"] as const) : []),
		...(span > 182 * DAY ? (["half"] as const) : []),
	];
	const since =
		period === "year"
			? last.time - 365 * DAY
			: period === "half"
				? last.time - 182 * DAY
				: -Infinity;
	const points = all.filter((p) => p.time >= since);
	const values = points.map((p) => p.value);
	const axis = niceAxis(Math.min(...values), Math.max(...values));
	const domain: [number, number] =
		points.length > 1
			? [points[0].time, last.time]
			: [last.time - 7 * DAY, last.time + 7 * DAY];
	const short = (time: number) =>
		format.date(time, {
			day: "numeric",
			month: "short",
			year: span > 300 * DAY ? "2-digit" : undefined,
		});
	const long = (time: number) =>
		format.date(time, {
			weekday: "short",
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	const average = values.reduce((s, v) => s + v, 0) / values.length;
	// A huge percentage from a tiny earlier value says nothing: the gap alone then.
	const pct =
		moved?.pct !== null &&
		moved?.pct !== undefined &&
		Math.abs(moved.pct) < 1000
			? moved.pct
			: null;

	return (
		<section
			className="grid min-w-0 content-start gap-5 p-5"
			aria-label={series.name}
		>
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="text-muted-foreground/70 text-[11px] font-medium tracking-wider uppercase">
						{series.group}
					</p>
					<h3 className="truncate text-lg font-semibold">{series.name}</h3>
					<p className="text-muted-foreground text-xs">
						{t("points", { count: all.length })}
						{all.length > 1 &&
							` · ${t("since", { date: format.date(all[0].time, { day: "numeric", month: "short", year: "numeric" }) })}`}
					</p>
				</div>
				<div className="text-end">
					<p className="flex items-baseline justify-end gap-1.5" dir="ltr">
						<span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
							{last.raw}
						</span>
						{unit && (
							<span className="text-muted-foreground text-sm">{unit}</span>
						)}
					</p>
					<p className="text-muted-foreground mt-1.5 text-xs">
						{format.date(last.time, {
							day: "numeric",
							month: "long",
							year: "numeric",
						})}
					</p>
					{moved && (
						<p
							className={cn(
								"mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
								moved.direction === "up"
									? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
									: moved.direction === "down"
										? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
										: "bg-muted text-muted-foreground",
							)}
							title={t("previous", {
								value: moved.before.raw,
								date: short(moved.before.time),
							})}
						>
							<span dir="ltr">
								{moved.direction === "up"
									? "↑ +"
									: moved.direction === "down"
										? "↓ −"
										: "= "}
								{fr(Math.abs(moved.diff))}
								{unit ? ` ${unit}` : ""}
								{pct !== null &&
									moved.direction !== "flat" &&
									` (${Math.abs(Math.round(pct))} %)`}
							</span>
							<span className="font-normal opacity-80">{t("vsPrevious")}</span>
						</p>
					)}
				</div>
			</header>

			{all.length === 1 ? (
				<p className="bg-muted/40 text-muted-foreground rounded-xl px-4 py-8 text-center text-sm">
					{t("single")}
				</p>
			) : (
				<div className="grid gap-2">
					{periods.length > 1 && (
						<div
							className="bg-muted inline-flex w-fit rounded-lg p-[3px] text-xs"
							role="radiogroup"
							aria-label={t("period")}
						>
							{periods.map((p) => (
								<button
									key={p}
									type="button"
									role="radio"
									aria-checked={p === period}
									onClick={() => setPeriod(p)}
									className={cn(
										"rounded-md px-2.5 py-1 font-medium",
										p === period
											? "bg-background shadow-sm"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{t(`periods.${p}`)}
								</button>
							))}
						</div>
					)}
					<ChartContainer
						config={{
							value: { label: series.name, color: "var(--highlight)" },
						}}
						className="aspect-auto h-64 w-full"
						dir="ltr"
					>
						<AreaChart
							data={points}
							margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
						>
							<defs>
								<linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="0%"
										stopColor="var(--color-value)"
										stopOpacity={0.18}
									/>
									<stop
										offset="100%"
										stopColor="var(--color-value)"
										stopOpacity={0}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid
								vertical={false}
								strokeDasharray="3 4"
								strokeOpacity={0.6}
							/>
							<XAxis
								dataKey="time"
								type="number"
								scale="time"
								domain={domain}
								ticks={points.map((p) => p.time)}
								tickFormatter={short}
								tickLine={false}
								axisLine={false}
								fontSize={11}
								minTickGap={28}
								tickMargin={8}
							/>
							<YAxis
								dataKey="value"
								tickLine={false}
								axisLine={false}
								fontSize={11}
								width={44}
								domain={axis.domain}
								ticks={axis.ticks}
								tickFormatter={(v: number) => fr(v)}
							/>
							<Tooltip
								cursor={{
									stroke: "var(--color-value)",
									strokeOpacity: 0.3,
									strokeDasharray: "3 3",
								}}
								content={({ active, payload }) => {
									const p = active
										? (payload?.[0]?.payload as Point | undefined)
										: undefined;
									if (!p) return null;
									return (
										<div className="bg-popover text-popover-foreground grid gap-0.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-md">
											<span className="text-muted-foreground">
												{long(p.time)}
											</span>
											<span className="font-semibold tabular-nums">
												{p.raw}
												{unit && (
													<span className="text-muted-foreground ms-1 font-normal">
														{unit}
													</span>
												)}
											</span>
										</div>
									);
								}}
							/>
							<Area
								dataKey="value"
								type="monotone"
								stroke="var(--color-value)"
								strokeWidth={2}
								fill={`url(#${gradient})`}
								dot={{
									r: 4,
									fill: "var(--color-value)",
									stroke: "var(--card)",
									strokeWidth: 2,
								}}
								activeDot={{
									r: 6,
									fill: "var(--color-value)",
									stroke: "var(--card)",
									strokeWidth: 2,
								}}
								isAnimationActive={false}
							/>
						</AreaChart>
					</ChartContainer>
					<dl className="grid grid-cols-3 gap-2 text-center">
						{(
							[
								["min", Math.min(...values)],
								["average", average],
								["max", Math.max(...values)],
							] as const
						).map(([key, value]) => (
							<div key={key} className="bg-muted/40 rounded-lg px-2 py-2">
								<dt className="text-muted-foreground text-[11px]">{t(key)}</dt>
								<dd className="text-sm font-semibold tabular-nums" dir="ltr">
									{fr(value)}
									{unit && (
										<span className="text-muted-foreground ms-1 text-[11px] font-normal">
											{unit}
										</span>
									)}
								</dd>
							</div>
						))}
					</dl>
				</div>
			)}

			<div className="overflow-hidden rounded-xl border">
				<table className="w-full text-sm">
					<caption className="sr-only">
						{t("values", { name: series.name })}
					</caption>
					<thead className="bg-muted/40 text-muted-foreground text-xs">
						<tr>
							<th className="px-3 py-2 text-start font-medium">{t("date")}</th>
							<th className="px-3 py-2 text-end font-medium">{t("value")}</th>
							<th className="px-3 py-2 text-end font-medium">{t("change")}</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{all
							.toReversed()
							.slice(0, 12)
							.map((p, i, newest) => {
								const older = newest[i + 1];
								const diff = older ? p.value - older.value : null;
								return (
									<tr key={p.day}>
										<td className="px-3 py-2">{long(p.time)}</td>
										<td
											className="px-3 py-2 text-end font-semibold tabular-nums"
											dir="ltr"
										>
											{p.raw}
										</td>
										<td
											className={cn(
												"px-3 py-2 text-end text-xs tabular-nums",
												diff === null || diff === 0
													? "text-muted-foreground"
													: diff > 0
														? "text-amber-700 dark:text-amber-400"
														: "text-sky-700 dark:text-sky-400",
											)}
											dir="ltr"
										>
											{diff === null
												? "—"
												: diff === 0
													? "="
													: `${diff > 0 ? "+" : "−"}${fr(Math.abs(diff))}`}
										</td>
									</tr>
								);
							})}
					</tbody>
				</table>
				{all.length > 12 && (
					<p className="text-muted-foreground border-t px-3 py-2 text-center text-xs">
						{t("older", { count: all.length - 12 })}
					</p>
				)}
			</div>
		</section>
	);
}
