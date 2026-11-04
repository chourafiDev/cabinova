"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuChartLine } from "react-icons/lu";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Consultation, VitalField } from "@/lib/consultations";
import { useFormat } from "@/lib/use-format";
import { Card } from "./patient-aside";

/** A measure over the visits: its lines, unit and colours. */
const MEASURES = {
	weight: { unit: "kg", lines: ["weightKg"] },
	pressure: { unit: "mmHg", lines: ["systolic", "diastolic"] },
	glycemia: { unit: "g/L", lines: ["glycemia", "glycemiaPostprandial"] },
	hba1c: { unit: "%", lines: ["hba1c"] },
} as const satisfies Record<string, { unit: string; lines: readonly VitalField[] }>;
type Measure = keyof typeof MEASURES;

const COLORS = ["#613F75", "#00a896"];

/** Dated measures, oldest first: the past visits and today's (as saved). */
export type Point = Pick<Consultation, VitalField> & { date: string };

/**
 * Courbes: weight, blood pressure, blood sugar and HbA1c across the visits,
 * for following a chronic patient at a glance. Only measures taken twice show.
 */
export function TrendsCard({ points }: { points: Point[] }) {
	const t = useTranslations("dossier.trends");
	const vitals = useTranslations("dossier.vitals");
	const fmt = useFormat();
	const available = (Object.keys(MEASURES) as Measure[]).filter(
		(m) => points.filter((p) => MEASURES[m].lines.some((f) => p[f] != null)).length >= 2,
	);
	const [chosen, setChosen] = useState<Measure | null>(null);
	const measure = chosen && available.includes(chosen) ? chosen : available[0];

	if (!measure) {
		return (
			<Card icon={LuChartLine} title={t("title")}>
				<p className="text-muted-foreground text-xs">{t("empty")}</p>
			</Card>
		);
	}

	const { unit, lines } = MEASURES[measure];
	const data = points
		.filter((p) => lines.some((f) => p[f] != null))
		.map((p) => ({ label: fmt.date(p.date, { day: "numeric", month: "short", year: "2-digit" }), ...p }));
	const config = Object.fromEntries(
		lines.map((f, i) => [f, { label: vitals(f === "weightKg" ? "weight" : f), color: COLORS[i] }]),
	) satisfies ChartConfig;

	return (
		<Card icon={LuChartLine} title={t("title")}>
			<Tabs value={measure} onValueChange={(v) => setChosen(v as Measure)}>
				<TabsList className="w-full">
					{available.map((m) => (
						<TabsTrigger key={m} value={m} className="text-xs">
							{t(`measures.${m}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			<p className="text-muted-foreground -mb-1 text-[11px]">{t("unit", { unit })}</p>
			<ChartContainer config={config} className="aspect-auto h-40 w-full">
				<LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
					<CartesianGrid vertical={false} />
					<XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} minTickGap={16} />
					<YAxis
						tickLine={false}
						axisLine={false}
						fontSize={10}
						width={40}
						domain={["auto", "auto"]}
						tickFormatter={(v: number) => String(Math.round(v * 10) / 10)}
					/>
					<ChartTooltip content={<ChartTooltipContent />} />
					{lines.map((f) => (
						<Line
							key={f}
							dataKey={f}
							type="monotone"
							stroke={`var(--color-${f})`}
							strokeWidth={2}
							dot={{ r: 3 }}
							connectNulls
						/>
					))}
				</LineChart>
			</ChartContainer>
		</Card>
	);
}
