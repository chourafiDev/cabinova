import { Badge } from "@/components/ui/badge";
import { CONSULTATION_STATUS_LABELS, type ConsultationStatus } from "@/lib/consultations";
import { cn } from "@/lib/utils";

export function ConsultationStatusBadge({ status }: { status: ConsultationStatus }) {
	return (
		<Badge
			variant="outline"
			className={cn(
				"border-transparent",
				status === "draft" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
			)}
		>
			{CONSULTATION_STATUS_LABELS[status]}
		</Badge>
	);
}
