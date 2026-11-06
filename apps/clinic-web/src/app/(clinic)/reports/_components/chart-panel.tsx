"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { IconChart, IconTable } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";

/** A chart with the same numbers one click away, as a table. */
export function ChartPanel({
	chart,
	table,
	...panel
}: Omit<React.ComponentProps<typeof Panel>, "action" | "children"> & { chart: React.ReactNode; table: React.ReactNode }) {
	const [view, setView] = useState<"chart" | "table">("chart");
	const t = useTranslations("reports.view");
	const button = (key: typeof view, label: string, Icon: typeof IconTable) => (
		<button
			type="button"
			aria-label={label}
			aria-pressed={view === key}
			title={label}
			onClick={() => setView(key)}
			className={cn(
				"flex size-7 items-center justify-center rounded-md transition-colors",
				view === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
			)}
		>
			<Icon className="size-3.5" />
		</button>
	);
	return (
		<Panel
			{...panel}
			action={
				<div className="bg-muted flex shrink-0 rounded-lg p-0.5" role="group" aria-label={t("label")}>
					{button("chart", t("chart"), IconChart)}
					{button("table", t("table"), IconTable)}
				</div>
			}
		>
			{view === "chart" ? chart : <div className="max-h-72 overflow-auto text-sm">{table}</div>}
		</Panel>
	);
}
