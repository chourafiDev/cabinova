import { useTranslations } from "next-intl";
import { IconLocation } from "@/components/icons";
import type { DashboardData } from "@/lib/dashboard";
import { ChartCard } from "./chart-card";

/** Every-space view: today and this month, space by space. */
export function SpacesOverview({ spaces }: { spaces: NonNullable<DashboardData["bySpace"]> }) {
	const t = useTranslations("dashboard");
	return (
		<ChartCard eyebrow={t("allSpaces")} title={t("spaces.title")}>
			<div className="-mx-2 overflow-x-auto">
				<table className="w-full text-sm tabular-nums">
					<thead>
						<tr className="text-muted-foreground text-xs">
							<th className="px-2 py-1.5 text-start font-normal">{t("spaces.space")}</th>
							<th className="px-2 py-1.5 text-end font-normal">{t("spaces.today")}</th>
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
								<td className="px-2 py-2 text-end">{s.appointmentsToday}</td>
								<td className="px-2 py-2 text-end">{s.waiting}</td>
								<td className="px-2 py-2 text-end">{s.seenToday}</td>
								<td className="px-2 py-2 text-end">{s.newPatientsMonth}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</ChartCard>
	);
}
