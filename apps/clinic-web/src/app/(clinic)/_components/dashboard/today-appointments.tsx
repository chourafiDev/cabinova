import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import type { Appointment } from "@/lib/sample-data";
import { cn } from "@/lib/utils";
import { AppointmentStatusBadge } from "./appointment-status";
import { ChartCard } from "./chart-card";

const FINISHED = new Set(["done", "no_show", "cancelled"]);

/** Today's schedule, in time order; finished ones are dimmed. */
export function TodayAppointments({ appointments }: { appointments: Appointment[] }) {
	const done = appointments.filter((a) => FINISHED.has(a.status)).length;

	return (
		<ChartCard
			eyebrow="Aujourd’hui"
			title="Rendez-vous du jour"
			headline={
				<p className="text-xs text-muted-foreground tabular-nums">
					{done} / {appointments.length} traités
				</p>
			}
			action={
				<Button asChild variant="outline" size="sm">
					<Link href="/appointments">Ouvrir l’agenda</Link>
				</Button>
			}
		>
			{appointments.length === 0 ? (
				<p className="py-10 text-center text-sm text-muted-foreground">Aucun rendez-vous aujourd’hui.</p>
			) : (
				<ol className="-mx-2 divide-y">
					{appointments.map((a) => (
						<li
							key={a.id}
							className={cn(
								"flex items-center gap-3 px-2 py-2.5",
								FINISHED.has(a.status) && "opacity-60",
								a.status === "in_consultation" && "bg-accent/60",
							)}
						>
							<div className="w-12 shrink-0 tabular-nums">
								<p className="text-sm font-semibold">{a.time}</p>
								<p className="text-[11px] text-muted-foreground">{a.durationMin} min</p>
							</div>
							<Avatar className="size-8 rounded-lg">
								<AvatarFallback className="rounded-lg bg-muted text-xs font-medium">
									{initials(a.patient.name)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p className="flex items-center gap-1.5 truncate text-sm font-medium">
									<span className="truncate">{a.patient.name}</span>
									{a.patient.isNew && (
										<span className="shrink-0 rounded-sm bg-primary/10 px-1 text-[10px] font-medium text-primary">
											Nouveau
										</span>
									)}
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{a.patient.age} ans · {a.reason}
								</p>
							</div>
							<AppointmentStatusBadge status={a.status} />
						</li>
					))}
				</ol>
			)}
		</ChartCard>
	);
}
