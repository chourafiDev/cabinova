"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { type Bucket, bucketLabel, bucketTitle, SERIES, type SeriesPoint } from "@/lib/reports";

type Key = keyof typeof SERIES & keyof SeriesPoint;

/**
 * Stacked columns over the period (one per day, week or month), in the
 * validated order of `keys`; a 2px surface gap between segments, a legend,
 * a tooltip listing every series, and the same numbers as a table.
 */
export function SeriesChart({
	series,
	bucket,
	keys,
	tableLabel,
}: {
	series: SeriesPoint[];
	bucket: Bucket;
	keys: Key[];
	/** First column of the table view, e.g. "Jour". */
	tableLabel: string;
}) {
	const config = Object.fromEntries(keys.map((k) => [k, SERIES[k]])) satisfies ChartConfig;
	const top = keys.at(-1);

	return (
		<>
			<ChartContainer config={config} className="aspect-auto h-64 w-full">
				<BarChart data={series} barCategoryGap="25%" margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="date"
						tickLine={false}
						axisLine={false}
						tickMargin={10}
						minTickGap={16}
						tickFormatter={(d: string) => bucketLabel(d, bucket)}
						className="text-[10px]"
					/>
					<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
					<ChartTooltip
						cursor={{ fill: "var(--muted)", radius: 4 }}
						content={
							<ChartTooltipContent
								indicator="line"
								labelFormatter={(_, payload) => (
									<span className="first-letter:uppercase">{bucketTitle(payload[0]?.payload.date, bucket)}</span>
								)}
							/>
						}
					/>
					<ChartLegend
						verticalAlign="top"
						itemSorter={(item) => keys.indexOf(item.dataKey as Key)}
						content={<ChartLegendContent verticalAlign="top" className="justify-end" />}
					/>
					{keys.map((k) => (
						<Bar
							key={k}
							dataKey={k}
							stackId="a"
							fill={`var(--color-${k})`}
							stroke="var(--card)"
							strokeWidth={2}
							maxBarSize={24}
							radius={k === top ? [4, 4, 0, 0] : 0}
						/>
					))}
				</BarChart>
			</ChartContainer>
			<details className="mt-2 text-xs">
				<summary className="text-muted-foreground cursor-pointer">Voir les données en tableau</summary>
				<div className="mt-2 max-h-64 overflow-auto">
					<table className="w-full tabular-nums">
						<thead className="bg-card sticky top-0">
							<tr className="text-muted-foreground">
								<th className="py-1 text-start font-normal">{tableLabel}</th>
								{keys.map((k) => (
									<th key={k} className="py-1 text-end font-normal">
										{SERIES[k].label}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y">
							{series.map((d) => (
								<tr key={d.date}>
									<td className="py-1 first-letter:uppercase">{bucketTitle(d.date, bucket)}</td>
									{keys.map((k) => (
										<td key={k} className="py-1 text-end">
											{d[k]}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</>
	);
}
