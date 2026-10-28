"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type { DashboardOverview } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { ChartCard } from "./chart-card";
import { SUBSCRIPTION_COLORS } from "./palette";

const config = {
	newSubscriptions: { label: "Nouveaux abonnements", theme: SUBSCRIPTION_COLORS.newSubscriptions },
	cancellations: { label: "Résiliations", theme: SUBSCRIPTION_COLORS.cancellations },
} satisfies ChartConfig;

const RANGES = { 6: "6 mois", 12: "12 mois" } as const;

const monthLabel = (month: string, style: "short" | "long" = "short") =>
	new Intl.DateTimeFormat("fr-MA", { month: style, ...(style === "long" && { year: "numeric" }) }).format(
		new Date(`${month}-01T00:00:00`),
	);

/**
 * Module 1 — new subscriptions vs cancellations per month. Headline totals
 * follow the selected range; the table view is the accessible equivalent.
 */
export function SubscriptionsChart({ series }: { series: DashboardOverview["series"] }) {
	const [range, setRange] = useState<6 | 12>(12);
	const data = series.slice(-range);
	const added = data.reduce((a, m) => a + m.newSubscriptions, 0);
	const lost = data.reduce((a, m) => a + m.cancellations, 0);
	const net = added - lost;

	return (
		<ChartCard
			title="Abonnements"
			className="h-full"
			headline={
				<p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span className="text-2xl font-semibold tabular-nums">{added}</span>
					<span className="text-xs text-muted-foreground">nouveaux · {lost} résiliation(s)</span>
					<span
						className={cn(
							"rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
							net > 0 && "bg-emerald-50 text-emerald-700",
							net < 0 && "bg-red-50 text-red-700",
							net === 0 && "bg-muted text-muted-foreground",
						)}
					>
						{net > 0 ? "+" : ""}
						{net} net
					</span>
				</p>
			}
			action={
				<>
					<div className="flex rounded-lg bg-muted p-0.5 text-xs" role="group" aria-label="Période">
						{([6, 12] as const).map((r) => (
							<button
								key={r}
								type="button"
								aria-pressed={range === r}
								onClick={() => setRange(r)}
								className={cn(
									"rounded-md px-2.5 py-1 text-muted-foreground transition-colors",
									range === r && "bg-foreground text-background",
								)}
							>
								{RANGES[r]}
							</button>
						))}
					</div>
				</>
			}
		>
			<ChartContainer config={config} className="aspect-auto h-60 w-full">
				<BarChart data={data} barGap={2} barCategoryGap="30%" margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="month"
						tickLine={false}
						axisLine={false}
						tickMargin={10}
						tickFormatter={(m) => monthLabel(m).replace(".", "").toUpperCase()}
						className="text-[10px]"
					/>
					<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
					<ChartTooltip
						cursor={{ fill: "var(--muted)", radius: 6 }}
						content={
							<ChartTooltipContent
								indicator="dot"
								labelFormatter={(_, payload) => (
									<span className="capitalize">{monthLabel(payload[0]?.payload.month, "long")}</span>
								)}
							/>
						}
					/>
					<ChartLegend
						verticalAlign="top"
						// Same order as the bars, not alphabetical.
						itemSorter={(item) => (item.dataKey === "newSubscriptions" ? 0 : 1)}
						content={<ChartLegendContent verticalAlign="top" className="justify-end" />} />
					<Bar dataKey="newSubscriptions" fill="var(--color-newSubscriptions)" radius={[4, 4, 0, 0]} maxBarSize={14} />
					<Bar dataKey="cancellations" fill="var(--color-cancellations)" radius={[4, 4, 0, 0]} maxBarSize={14} />
				</BarChart>
			</ChartContainer>
			<details className="mt-2 text-xs">
				<summary className="cursor-pointer text-muted-foreground">Voir les données en tableau</summary>
				<table className="mt-2 w-full tabular-nums">
					<thead>
						<tr className="text-muted-foreground">
							<th className="py-1 text-start font-normal">Mois</th>
							<th className="py-1 text-end font-normal">Nouveaux cabinets</th>
							<th className="py-1 text-end font-normal">Nouveaux abonnements</th>
							<th className="py-1 text-end font-normal">Résiliations</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{data.map((m) => (
							<tr key={m.month}>
								<td className="py-1 capitalize">{monthLabel(m.month, "long")}</td>
								<td className="py-1 text-end">{m.newTenants}</td>
								<td className="py-1 text-end">{m.newSubscriptions}</td>
								<td className="py-1 text-end">{m.cancellations}</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
		</ChartCard>
	);
}
