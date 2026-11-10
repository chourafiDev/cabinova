"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { directionOf, intlLocale } from "@/i18n/config";
import { type Bucket, MAGNITUDE } from "@/lib/reports";
import { useFormat } from "@/lib/use-format";

/** Compact MAD for the axis: 125000 (centimes) → "1,3 k". */
const axis = (centimes: number, locale: string) => {
	const value = centimes / 100;
	return value >= 1000 ? `${(value / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} k` : String(Math.round(value));
};

/** Money received per day, week or month: one series, so no legend. */
export function RevenueChart({ series, bucket }: { series: { date: string; net: number }[]; bucket: Bucket }) {
	const t = useTranslations("reports.revenue");
	const format = useFormat();
	const locale = useLocale();
	const rtl = directionOf(locale) === "rtl";
	const config = { net: { label: t("received"), color: MAGNITUDE } } satisfies ChartConfig;
	return (
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
					<YAxis tickLine={false} axisLine={false} width={44} orientation={rtl ? "right" : "left"} tickFormatter={(v: number) => axis(v, intlLocale(locale))} />
					<ChartTooltip
						cursor={{ fill: "var(--muted)", radius: 4 }}
						content={
							<ChartTooltipContent
								indicator="line"
								formatter={(value) => <span className="font-medium tabular-nums">{format.mad(Number(value))}</span>}
								labelFormatter={(_, payload) => (
									<span className="first-letter:uppercase">{format.bucketTitle(payload[0]?.payload.date, bucket)}</span>
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
	const format = useFormat();
	return (
		<table className="w-full tabular-nums">
			<tbody className="divide-y">
				{series.map((d) => (
					<tr key={d.date}>
						<td className="py-2 first-letter:uppercase">{format.bucketTitle(d.date, bucket)}</td>
						<td className="py-2 text-end">{format.mad(d.net)}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
