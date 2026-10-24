"use client";

import Link from "next/link";
import { Label, Pie, PieChart } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Breakdown } from "@/lib/dashboard";
import { ChartCard } from "./chart-card";
import { NEUTRAL, PLAN_COLORS } from "./palette";

/**
 * Cabinets by plan: a donut with the total in the middle and a legend that
 * carries every value (count and %), so colour is never the only key. Each
 * plan keeps its colour from the catalog order, whatever the filters.
 */
export function PlansDonut({
	rows,
	planOrder,
	hrefs,
}: {
	rows: Breakdown;
	/** Every plan key in catalog order, to give each plan a stable colour. */
	planOrder: string[];
	/** Dashboard filtered on each plan key. */
	hrefs: Record<string, string>;
}) {
	const total = rows.reduce((a, r) => a + r.value, 0);
	const colorOf = (key = "none") => {
		const i = planOrder.indexOf(key);
		return i === -1 ? NEUTRAL : PLAN_COLORS[i % PLAN_COLORS.length];
	};
	// "Sans offre" last, so grey closes the ring between the last plan and the first.
	const data = [...rows]
		.sort((a, b) => Number(a.key === "none") - Number(b.key === "none"))
		.map((r) => ({ ...r, plan: r.key ?? "none", fill: `var(--color-${r.key ?? "none"})` }));
	const config = Object.fromEntries(
		data.map((r) => [r.key ?? "none", { label: r.label, theme: colorOf(r.key) }]),
	) satisfies ChartConfig;

	return (
		<ChartCard title="Cabinets par offre" className="h-full">
			{total === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">Aucun cabinet.</p>
			) : (
				<div className="grid gap-4">
					<ChartContainer config={config} className="mx-auto aspect-square h-48">
						<PieChart>
							<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="plan" />} />
							<Pie
								data={data}
								dataKey="value"
								nameKey="plan"
								innerRadius={60}
								outerRadius={86}
								paddingAngle={data.length > 1 ? 2 : 0}
								cornerRadius={4}
								strokeWidth={0}
							>
								<Label
									content={({ viewBox }) =>
										viewBox && "cx" in viewBox && "cy" in viewBox ? (
											<text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
												<tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
													{total}
												</tspan>
												<tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
													cabinets
												</tspan>
											</text>
										) : null
									}
								/>
							</Pie>
						</PieChart>
					</ChartContainer>
					<ul className="grid gap-2 text-sm">
						{data.map((r) => {
							const key = r.key ?? "none";
							return (
								<li key={key}>
									<Link
										href={hrefs[key] ?? "#"}
										scroll={false}
										className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted"
									>
										<span className="size-2.5 rounded-full" style={{ background: colorOf(r.key).light }} aria-hidden />
										<span className="min-w-0 flex-1 truncate">{r.label}</span>
										<span className="tabular-nums">{r.value}</span>
										<span className="w-12 text-end text-xs tabular-nums text-muted-foreground">
											{Math.round((r.value / total) * 100)} %
										</span>
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</ChartCard>
	);
}
