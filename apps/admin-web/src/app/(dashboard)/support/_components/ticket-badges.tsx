import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABELS, STATUS_LABELS, type TicketPriority, type TicketStatus, TYPE_LABELS, type TicketType } from "@/lib/support";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<TicketStatus, string> = {
	open: "bg-sky-50 text-sky-700",
	in_progress: "bg-violet-50 text-violet-700",
	waiting: "bg-amber-50 text-amber-800",
	resolved: "bg-emerald-50 text-emerald-700",
	closed: "bg-zinc-100 text-zinc-600",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
	return (
		<Badge variant="outline" className={cn("border-transparent", STATUS_TONES[status])}>
			{STATUS_LABELS[status]}
		</Badge>
	);
}

const PRIORITY_DOTS: Record<TicketPriority, string> = {
	urgent: "bg-red-600",
	high: "bg-orange-500",
	normal: "bg-sky-500",
	low: "bg-zinc-400",
};

/** A coloured dot + word: never colour alone. */
export function PriorityLabel({ priority, className }: { priority: TicketPriority; className?: string }) {
	return (
		<span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
			<span className={cn("size-2 rounded-full", PRIORITY_DOTS[priority])} aria-hidden />
			{PRIORITY_LABELS[priority]}
		</span>
	);
}

export function TicketTypeBadge({ type }: { type: TicketType }) {
	return (
		<Badge
			variant="outline"
			className={cn(
				"border-transparent font-normal",
				type === "incident" ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground",
			)}
		>
			{TYPE_LABELS[type]}
		</Badge>
	);
}
