import { LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert } from "react-icons/lu";
import Link from "next/link";
import type { DashboardAlert } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { ChartCard } from "./chart-card";

const SEVERITY = {
	critical: { icon: LuCircleAlert, label: "Critique", tone: "bg-red-50 text-red-700" },
	warning: { icon: LuTriangleAlert, label: "Attention", tone: "bg-amber-50 text-amber-800" },
	info: { icon: LuInfo, label: "Info", tone: "bg-sky-50 text-sky-700" },
} as const;

/** What the alerts watch, shown as passed checks when nothing is wrong. */
const CHECKS = ["Bases des cabinets joignables", "Schémas et provisionnements à jour", "Aucune facture impayée"];

/**
 * Platform-wide alerts (never filtered). Severity is an icon + a label, not
 * colour alone; each alert lists the first cabinets concerned.
 */
export function AlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
	const critical = alerts.filter((a) => a.severity === "critical").length;

	return (
		<ChartCard
			eyebrow="Surveillance"
			title="Alertes"
			className="h-full"
			headline={
				<p className="flex items-baseline gap-2">
					<span className="text-2xl font-semibold tabular-nums">{alerts.length}</span>
					<span className="text-xs text-muted-foreground">
						{alerts.length === 0 ? "tout est en ordre" : critical ? `dont ${critical} critique(s)` : "à surveiller"}
					</span>
				</p>
			}
		>
			{alerts.length === 0 ? (
				<ul className="grid gap-2.5 text-sm">
					{CHECKS.map((check) => (
						<li key={check} className="flex items-center gap-2.5">
							<span className="flex size-6 items-center justify-center rounded-md bg-emerald-50">
								<LuCircleCheck className="size-3.5 text-emerald-600" aria-hidden />
							</span>
							{check}
						</li>
					))}
				</ul>
			) : (
				<ul className="grid gap-3">
					{alerts.map((alert) => {
						const { icon: Icon, label, tone } = SEVERITY[alert.severity];
						return (
							<li key={alert.key} className="grid gap-1.5">
								<Link href={alert.href} className="flex items-center gap-2.5 text-sm hover:underline">
									<span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", tone)}>
										<Icon className="size-3.5" aria-label={label} />
									</span>
									<span className="min-w-0 flex-1 font-medium">{alert.title}</span>
									<span className={cn("rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", tone)}>
										{alert.count}
									</span>
								</Link>
								<ul className="ms-8.5 grid gap-0.5 text-xs text-muted-foreground">
									{alert.items.map((item) => (
										<li key={item.href ?? item.tenantId} className="truncate">
											<Link href={item.href ?? `/tenants/${item.tenantId}`} className="text-foreground hover:underline">
												{item.name}
											</Link>
											{item.detail && ` — ${item.detail}`}
										</li>
									))}
									{alert.count > alert.items.length && <li>… et {alert.count - alert.items.length} autre(s)</li>}
								</ul>
							</li>
						);
					})}
				</ul>
			)}
		</ChartCard>
	);
}
