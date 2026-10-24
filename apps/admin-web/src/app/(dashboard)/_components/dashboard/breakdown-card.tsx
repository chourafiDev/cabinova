"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Breakdown } from "@/lib/dashboard";
import { ChartCard } from "./chart-card";
import { MAGNITUDE, NEUTRAL } from "./palette";

const config = {
	value: { label: "Cabinets", theme: MAGNITUDE },
	other: { label: "Cabinets", theme: NEUTRAL },
} satisfies ChartConfig;

const ROW_HEIGHT = 36;

/**
 * A single-series ranking (cabinets by city / specialty) as a shadcn
 * horizontal bar chart: category on the left, value at the end of the bar,
 * one hue (magnitude only). Rows that can't be filtered on ("Autres", not
 * filled in) are grey. Clicking a bar filters the dashboard on it.
 */
export function BreakdownCard({
	title,
	rows,
	hrefs,
}: {
	title: string;
	rows: Breakdown;
	/** Dashboard URL filtered on each row label; missing = not filterable. */
	hrefs: Record<string, string>;
}) {
	const router = useRouter();
	const total = rows.reduce((a, r) => a + r.value, 0);
	const data = rows.map((r) => ({
		...r,
		share: total ? Math.round((r.value / total) * 100) : 0,
		href: hrefs[r.label],
	}));

	return (
		<ChartCard title={title} className="h-full">
			{rows.length === 0 ? (
				<p className="py-6 text-center text-sm text-muted-foreground">Aucun cabinet.</p>
			) : (
				<ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * ROW_HEIGHT + 8 }}>
					<BarChart data={data} layout="vertical" margin={{ left: 0, right: 44, top: 0, bottom: 0 }} barCategoryGap={10}>
						<YAxis
							dataKey="label"
							type="category"
							tickLine={false}
							axisLine={false}
							width={90}
							tick={{ fontSize: 12 }}
							tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
						/>
						<XAxis type="number" dataKey="value" hide allowDecimals={false} />
						<ChartTooltip
							cursor={{ fill: "var(--muted)", radius: 6 }}
							content={
								<ChartTooltipContent
									hideIndicator
									formatter={(value, _name, item) => (
										<span className="tabular-nums">
											{value} cabinet{Number(value) > 1 ? "s" : ""} · {item.payload.share} %
										</span>
									)}
								/>
							}
						/>
						<Bar
							dataKey="value"
							radius={4}
							maxBarSize={14}
							className="cursor-pointer"
							onClick={(entry: { payload?: { href?: string } }) => {
								if (entry.payload?.href) router.push(entry.payload.href, { scroll: false });
							}}
						>
							{data.map((r) => (
								<Cell key={r.label} fill={r.href ? "var(--color-value)" : "var(--color-other)"} />
							))}
							<LabelList
								dataKey="value"
								position="right"
								offset={8}
								className="fill-foreground tabular-nums"
								fontSize={12}
							/>
						</Bar>
					</BarChart>
				</ChartContainer>
			)}
		</ChartCard>
	);
}
