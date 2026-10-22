import { differenceInMinutes, format, parseISO } from "date-fns";
import { CalendarPlus, ChevronRight, Stethoscope } from "lucide-react";
import Link from "next/link";
import { fmt } from "@/calendar/locale";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { Button } from "@/components/ui/button";
import type { Appointment } from "@/lib/appointments";
import { cn } from "@/lib/utils";
import { FormCard } from "../../../_components/shared/form-card";

/** Upcoming first (soonest on top), then the history (latest on top). */
export function PatientAppointments({
	appointments,
	bookHref,
}: {
	appointments: Appointment[];
	/** Booking link; absent when the user can't book or the file is archived. */
	bookHref?: string;
}) {
	const now = new Date();
	const isUpcoming = (a: Appointment) =>
		parseISO(a.endsAt) >= now && !["cancelled", "no_show", "completed"].includes(a.status);
	const upcoming = appointments.filter(isUpcoming);
	const history = appointments.filter((a) => !isUpcoming(a)).reverse();

	return (
		<div className="grid gap-3">
			<FormCard
				title={`À venir (${upcoming.length})`}
				action={
					bookHref && (
						<Button asChild size="sm">
							<Link href={bookHref}>
								<CalendarPlus className="size-4" />
								Prendre rendez-vous
							</Link>
						</Button>
					)
				}
			>
				<AppointmentList items={upcoming} empty="Aucun rendez-vous à venir." />
			</FormCard>
			<FormCard title={`Historique (${history.length})`}>
				<AppointmentList items={history} empty="Aucun rendez-vous passé." muted />
			</FormCard>
		</div>
	);
}

function AppointmentList({ items, empty, muted }: { items: Appointment[]; empty: string; muted?: boolean }) {
	if (!items.length) return <p className="text-muted-foreground py-2 text-sm">{empty}</p>;

	return (
		<ul className="divide-y rounded-lg border">
			{items.map((a) => {
				const start = parseISO(a.startsAt);
				const end = parseISO(a.endsAt);
				return (
					<li key={a.id}>
						<Link
							href={`/appointments?view=day&date=${format(start, "yyyy-MM-dd")}`}
							className="hover:bg-muted/60 flex items-center gap-3 px-3 py-2.5 transition-colors"
						>
							<div
								className={cn(
									"flex size-11 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
									muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
								)}
							>
								<span className="text-base font-semibold tabular-nums">{fmt(start, "d")}</span>
								<span className="text-[10px] font-medium uppercase">{fmt(start, "MMM")}</span>
							</div>
							<div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
								<span className="text-sm font-medium first-letter:uppercase">
									{fmt(start, "EEEE d MMMM yyyy")} · {fmt(start, "HH:mm")}–{fmt(end, "HH:mm")}
									<span className="text-muted-foreground font-normal"> ({differenceInMinutes(end, start)} min)</span>
								</span>
								<span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
									<Stethoscope className="size-3 shrink-0" />
									{a.practitioner.name}
									{a.reason && ` · ${a.reason}`}
								</span>
							</div>
							<AppointmentStatusBadge status={a.status} />
							<ChevronRight className="text-muted-foreground size-4 shrink-0" />
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
