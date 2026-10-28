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
import { formatDate } from "@/lib/format";
import type { DashboardData } from "@/lib/dashboard";
import { ChartCard } from "./chart-card";

// Violet + aqua: the pair validated for the Super Admin charts (palette.ts there).
const config = {
	appointments: { label: "Rendez-vous", theme: { light: "#613F75", dark: "#724e91" } },
	consultations: { label: "Consultations", theme: { light: "#00a896", dark: "#00a896" } },
} satisfies ChartConfig;

const dayLabel = (date: string, weekday: "short" | "long" = "short") =>
	formatDate(`${date}T12:00:00`, { weekday, day: "numeric", month: weekday === "long" ? "long" : undefined, year: undefined });

/** Monday → Saturday: booked appointments vs consultations done. */
export function WeekActivityChart({ week }: { week: DashboardData["week"] }) {
	const booked = week.reduce((s, d) => s + d.appointments, 0);
	const seen = week.reduce((s, d) => s + d.consultations, 0);

	return (
		<ChartCard
			title="Activité de la semaine"
			className="h-full"
			headline={
				<p className="flex flex-wrap items-baseline gap-x-3">
					<span className="text-2xl font-semibold tabular-nums">{seen}</span>
					<span className="text-xs text-muted-foreground">consultations · {booked} rendez-vous prévus</span>
				</p>
			}
		>
			<ChartContainer config={config} className="aspect-auto h-60 w-full">
				<BarChart data={week} barGap={2} barCategoryGap="30%" margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="date"
						tickLine={false}
						axisLine={false}
						tickMargin={10}
						tickFormatter={(d) => dayLabel(d).replace(".", "")}
						className="text-[10px] capitalize"
					/>
					<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
					<ChartTooltip
						cursor={{ fill: "var(--muted)", radius: 6 }}
						content={
							<ChartTooltipContent
								indicator="dot"
								labelFormatter={(_, payload) => (
									<span className="capitalize">{dayLabel(payload[0]?.payload.date, "long")}</span>
								)}
							/>
						}
					/>
					<ChartLegend
						verticalAlign="top"
						itemSorter={(item) => (item.dataKey === "appointments" ? 0 : 1)}
						content={<ChartLegendContent verticalAlign="top" className="justify-end" />}
					/>
					<Bar dataKey="appointments" fill="var(--color-appointments)" radius={[4, 4, 0, 0]} maxBarSize={14} />
					<Bar dataKey="consultations" fill="var(--color-consultations)" radius={[4, 4, 0, 0]} maxBarSize={14} />
				</BarChart>
			</ChartContainer>
			<details className="mt-2 text-xs">
				<summary className="cursor-pointer text-muted-foreground">Voir les données en tableau</summary>
				<table className="mt-2 w-full tabular-nums">
					<thead>
						<tr className="text-muted-foreground">
							<th className="py-1 text-start font-normal">Jour</th>
							<th className="py-1 text-end font-normal">Rendez-vous</th>
							<th className="py-1 text-end font-normal">Consultations</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{week.map((d) => (
							<tr key={d.date}>
								<td className="py-1 capitalize">{dayLabel(d.date, "long")}</td>
								<td className="py-1 text-end">{d.appointments}</td>
								<td className="py-1 text-end">{d.consultations}</td>
							</tr>
						))}
					</tbody>
				</table>
			</details>
		</ChartCard>
	);
}
