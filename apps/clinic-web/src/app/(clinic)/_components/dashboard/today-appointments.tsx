import Link from "next/link";
import { differenceInMinutes } from "date-fns";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { type DashboardData, clock } from "@/lib/dashboard";
import { initials } from "@/lib/format";
import { ageOf, fullName, patientHref } from "@/lib/patients";
import { cn } from "@/lib/utils";
import { ChartCard } from "./chart-card";

const FINISHED = new Set(["completed", "no_show", "cancelled"]);

/** Today's schedule, in time order; finished ones are dimmed. */
export function TodayAppointments({ appointments }: { appointments: NonNullable<DashboardData["appointments"]> }) {
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
					<Link href="/appointments?view=day">Ouvrir l’agenda</Link>
				</Button>
			}
		>
			{appointments.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-10 text-center">
					<p className="text-sm text-muted-foreground">Aucun rendez-vous aujourd’hui.</p>
					<Button asChild size="sm" variant="outline">
						<Link href="/appointments">Planifier un rendez-vous</Link>
					</Button>
				</div>
			) : (
				<ol className="-mx-2 divide-y">
					{appointments.map((a) => {
						const age = ageOf(a.patient.birthDate);
						return (
							<li
								key={a.id}
								className={cn(
									"relative flex items-center gap-3 rounded-lg px-2 py-2.5",
									FINISHED.has(a.status) && "opacity-60",
									a.status === "in_consultation" && "bg-accent/60",
								)}
							>
								<div className="w-12 shrink-0 tabular-nums">
									<p className="text-sm font-semibold">{clock(a.startsAt)}</p>
									<p className="text-[11px] text-muted-foreground">
										{differenceInMinutes(new Date(a.endsAt), new Date(a.startsAt))} min
									</p>
								</div>
								<Avatar className="size-8 rounded-full">
									<AvatarFallback className="rounded-full bg-muted text-xs font-medium">
										{initials(`${a.patient.firstName} ${a.patient.lastName}`)}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<p className="flex items-center gap-1.5 truncate text-sm font-medium">
										<Link href={patientHref(a.patient.id)} className="truncate after:absolute after:inset-0">
											{fullName(a.patient)}
										</Link>
										{a.firstVisit && (
											<span className="shrink-0 rounded-sm bg-primary/10 px-1 text-[10px] font-medium text-primary">
												Nouveau
											</span>
										)}
									</p>
									<p className="truncate text-xs text-muted-foreground">
										{[age !== null && `${age} ans`, a.reason, a.practitioner.name].filter(Boolean).join(" · ")}
									</p>
								</div>
								<AppointmentStatusBadge status={a.status} />
							</li>
						);
					})}
				</ol>
			)}
		</ChartCard>
	);
}
