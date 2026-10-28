import { LuMapPin } from "react-icons/lu";
import type { DashboardData } from "@/lib/dashboard";
import { ChartCard } from "./chart-card";

/** Every-space view: today and this month, space by space. */
export function SpacesOverview({ spaces }: { spaces: NonNullable<DashboardData["bySpace"]> }) {
	return (
		<ChartCard eyebrow="Tous les espaces" title="Par espace">
			<div className="-mx-2 overflow-x-auto">
				<table className="w-full text-sm tabular-nums">
					<thead>
						<tr className="text-muted-foreground text-xs">
							<th className="px-2 py-1.5 text-start font-normal">Espace</th>
							<th className="px-2 py-1.5 text-end font-normal">RDV aujourd’hui</th>
							<th className="px-2 py-1.5 text-end font-normal">En attente</th>
							<th className="px-2 py-1.5 text-end font-normal">Vus</th>
							<th className="px-2 py-1.5 text-end font-normal">Nouveaux patients (mois)</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{spaces.map((s) => (
							<tr key={s.id}>
								<td className="px-2 py-2">
									<span className="flex items-center gap-1.5 font-medium">
										<LuMapPin className="text-muted-foreground size-3.5" />
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
