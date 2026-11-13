import { useTranslations } from "next-intl";
import { IconLocation } from "@/components/icons";
import type { DashboardData } from "@/lib/dashboard";
import { ChartCard } from "./chart-card";

/** Every-space view: the period, space by space (waiting: right now). */
export function SpacesOverview({ spaces }: { spaces: NonNullable<DashboardData["bySpace"]> }) {
	const t = useTranslations("dashboard");
	return (
		<ChartCard eyebrow={t("allSpaces")} title={t("spaces.title")}>
			<div className="-mx-2 overflow-x-auto">
				<table className="w-full text-sm tabular-nums">
					<thead>
						<tr className="text-muted-foreground text-xs">
							<th className="px-2 py-1.5 text-start font-normal">{t("spaces.space")}</th>
							<th className="px-2 py-1.5 text-end font-normal">{t("spaces.appointments")}</th>
							<th className="px-2 py-1.5 text-end font-normal">{t("spaces.waiting")}</th>
							<th className="px-2 py-1.5 text-end font-normal">{t("spaces.seen")}</th>
							<th className="px-2 py-1.5 text-end font-normal">{t("spaces.newPatients")}</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{spaces.map((s) => (
							<tr key={s.id}>
								<td className="px-2 py-2">
									<span className="flex items-center gap-1.5 font-medium">
										<IconLocation className="text-muted-foreground size-3.5" />
										{s.name}
									</span>
									{s.city && <span className="text-muted-foreground ms-5 text-xs">{s.city}</span>}
								</td>
								<td className="px-2 py-2 text-end">{s.appointments}</td>
								<td className="px-2 py-2 text-end">{s.waiting}</td>
								<td className="px-2 py-2 text-end">{s.seen}</td>
								<td className="px-2 py-2 text-end">{s.newPatients}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</ChartCard>
	);
}
