import { useTranslations } from "next-intl";
import type { TEventColor } from "@/calendar/types";
import { Badge } from "@/components/ui/badge";
import { type AppointmentStatus, STATUS_COLORS } from "@/lib/appointments";
import { cn } from "@/lib/utils";

/** The agenda's tints (calendar event blocks), so a status reads the same everywhere. */
const TINTS: Record<TEventColor, string> = {
	blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
	green: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
	red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
	yellow: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
	purple: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
	orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
	amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
	brand: "border-primary/40 bg-primary/15 text-primary dark:border-primary/50 dark:bg-primary/25",
	gray: "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
};

/** A visit's status, in its agenda colour (Annulé struck through, as in the agenda). */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
	const t = useTranslations("common.appointmentStatus");
	return (
		<Badge variant="outline" className={cn(TINTS[STATUS_COLORS[status]], status === "cancelled" && "line-through")}>
			{t(status)}
		</Badge>
	);
}
