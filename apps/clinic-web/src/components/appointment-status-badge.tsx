import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/lib/appointments";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<AppointmentStatus, string> = {
	scheduled: "bg-sky-500",
	confirmed: "bg-violet-500",
	arrived: "bg-amber-500",
	in_consultation: "bg-orange-500",
	completed: "bg-emerald-500",
	no_show: "bg-red-500",
	cancelled: "bg-zinc-500 ",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
	const t = useTranslations("common.appointmentStatus");
	return (
		<Badge variant="outline" className={cn("border-transparent text-white", STATUS_BADGE[status])}>
			{t(status)}
		</Badge>
	);
}
