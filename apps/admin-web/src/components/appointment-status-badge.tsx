import { Badge } from "@/components/ui/badge";
import { type AppointmentStatus, STATUS_LABELS } from "@/lib/appointments";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<AppointmentStatus, string> = {
	scheduled: "bg-blue-50 text-blue-700",
	confirmed: "bg-purple-50 text-purple-700",
	arrived: "bg-orange-50 text-orange-700",
	completed: "bg-green-50 text-green-700",
	no_show: "bg-red-50 text-red-700",
	cancelled: "bg-zinc-100 text-zinc-500",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
	return (
		<Badge variant="outline" className={cn("border-transparent", STATUS_BADGE[status])}>
			{STATUS_LABELS[status]}
		</Badge>
	);
}
