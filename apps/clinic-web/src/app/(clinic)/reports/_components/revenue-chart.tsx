"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { mad } from "@/lib/payments";
import { type Bucket, bucketLabel, bucketTitle, MAGNITUDE } from "@/lib/reports";

const config = { net: { label: "Encaissé", color: MAGNITUDE } } satisfies ChartConfig;

/** Compact MAD for the axis: 125000 (centimes) → "1,3 k". */
const axis = (centimes: number) => {
	const value = centimes / 100;
	return value >= 1000 ? `${(value / 1000).toLocaleString("fr-MA", { maximumFractionDigits: 1 })} k` : String(Math.round(value));
};

/** Money received per day, week or month: one series, so no legend. */
export function RevenueChart({ series, bucket }: { series: { date: string; net: number }[]; bucket: Bucket }) {
	return (
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
					<YAxis tickLine={false} axisLine={false} width={44} tickFormatter={axis} />
					<ChartTooltip
						cursor={{ fill: "var(--muted)", radius: 4 }}
						content={
							<ChartTooltipContent
								indicator="line"
								formatter={(value) => <span className="font-medium tabular-nums">{mad(Number(value))}</span>}
								labelFormatter={(_, payload) => (
									<span className="first-letter:uppercase">{bucketTitle(payload[0]?.payload.date, bucket)}</span>
								)}
							/>
						}
					/>
					<Bar dataKey="net" isAnimationActive={false} fill="var(--color-net)" radius={[4, 4, 0, 0]} maxBarSize={24} />
				</BarChart>
			</ChartContainer>
	);
}

/** The same numbers as the chart. */
export function RevenueTable({ series, bucket }: { series: { date: string; net: number }[]; bucket: Bucket }) {
	return (
		<table className="w-full tabular-nums">
			<tbody className="divide-y">
				{series.map((d) => (
					<tr key={d.date}>
						<td className="py-2 first-letter:uppercase">{bucketTitle(d.date, bucket)}</td>
						<td className="py-2 text-end">{mad(d.net)}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
