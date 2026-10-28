import type { AppointmentStatus } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; className: string }> = {
	scheduled: { label: "Planifié", className: "bg-muted text-muted-foreground" },
	confirmed: { label: "Confirmé", className: "bg-sky-50 text-sky-800" },
	arrived: { label: "En salle d’attente", className: "bg-amber-50 text-amber-800" },
	in_consultation: { label: "En consultation", className: "bg-accent text-primary" },
	done: { label: "Terminé", className: "bg-emerald-50 text-emerald-800" },
	no_show: { label: "Absent", className: "bg-red-50 text-red-700" },
	cancelled: { label: "Annulé", className: "bg-muted text-muted-foreground line-through" },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
	const { label, className } = APPOINTMENT_STATUS[status];
	return (
		<span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", className)}>
			{label}
		</span>
	);
}
