"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { directionOf } from "@/i18n/config";
import { type Bucket, SERIES, type SeriesPoint } from "@/lib/reports";
import { useFormat } from "@/lib/use-format";

type Key = keyof typeof SERIES & keyof SeriesPoint;

/** The legend sits outside the chart: same colours as SERIES, light and dark. */
const SWATCHES: Record<Key, string> = {
	completed: "bg-[#724e91]",
	pending: "bg-[#00a896]",
	noShow: "bg-[#eda100] dark:bg-[#c98500]",
	cancelled: "bg-[#c3c2b7] dark:bg-[#5f5e58]",
	newPatients: "bg-[#724e91]",
	returningPatients: "bg-[#00a896]",
};

/**
 * Stacked columns over the period (one per day, week or month), in the
 * validated order of `keys`; a 2px surface gap between segments, a tooltip
 * listing every series, and a legend that carries each series' total.
 */
export function SeriesChart({
	series,
	bucket,
	keys,
	totals,
}: {
	series: SeriesPoint[];
	bucket: Bucket;
	keys: Key[];
	totals: Partial<Record<Key, number>>;
}) {
	const t = useTranslations("reports.series");
	const format = useFormat();
	const rtl = directionOf(useLocale()) === "rtl";
	const config = Object.fromEntries(keys.map((k) => [k, { ...SERIES[k], label: t(k) }])) satisfies ChartConfig;
	const top = keys.at(-1);

	return (
		<div className="grid gap-4">
			<ul className="flex flex-wrap gap-x-6 gap-y-2">
				{keys.map((k) => (
					<li key={k} className="grid gap-0.5">
						<span className="text-muted-foreground flex items-center gap-1.5 text-xs">
							<span className={`size-2 rounded-[2px] ${SWATCHES[k]}`} />
							{t(k)}
						</span>
						<span className="text-lg font-semibold tabular-nums">{totals[k] ?? 0}</span>
					</li>
				))}
			</ul>
			<ChartContainer config={config} className="aspect-auto h-64 w-full">
				<BarChart data={series} barCategoryGap="25%" margin={rtl ? { top: 8, right: -8, left: 0, bottom: 0 } : { top: 8, right: 0, left: -8, bottom: 0 }}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="date"
						reversed={rtl}
						tickLine={false}
						axisLine={false}
						tickMargin={10}
						minTickGap={16}
						tickFormatter={(d: string) => format.bucketLabel(d, bucket)}
						className="text-[10px]"
					/>
					<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} orientation={rtl ? "right" : "left"} />
					<ChartTooltip
						cursor={{ fill: "var(--muted)", radius: 4 }}
						content={
							<ChartTooltipContent
								indicator="line"
								labelFormatter={(_, payload) => (
									<span className="first-letter:uppercase">{format.bucketTitle(payload[0]?.payload.date, bucket)}</span>
								)}
							/>
						}
					/>
					{keys.map((k) => (
						<Bar
							key={k}
							dataKey={k}
							stackId="a"
							isAnimationActive={false}
							fill={`var(--color-${k})`}
							stroke="var(--card)"
							strokeWidth={2}
							maxBarSize={24}
							radius={k === top ? [4, 4, 0, 0] : 0}
						/>
					))}
				</BarChart>
			</ChartContainer>
		</div>
	);
}

/** The same numbers as the chart. */
export function SeriesTable({
	series,
	bucket,
	keys,
	label,
}: {
	series: SeriesPoint[];
	bucket: Bucket;
	keys: Key[];
	/** First column, e.g. "Jour". */
	label: string;
}) {
	const t = useTranslations("reports.series");
	const format = useFormat();
	return (
		<table className="w-full tabular-nums">
			<thead className="bg-card sticky top-0">
				<tr className="text-muted-foreground border-b">
					<th className="py-2 text-start font-normal">{label}</th>
					{keys.map((k) => (
						<th key={k} className="py-2 text-end font-normal">
							{t(k)}
						</th>
					))}
				</tr>
			</thead>
			<tbody className="divide-y">
				{series.map((d) => (
					<tr key={d.date}>
						<td className="py-2 first-letter:uppercase">{format.bucketTitle(d.date, bucket)}</td>
						{keys.map((k) => (
							<td key={k} className="py-2 text-end">
								{d[k]}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}
