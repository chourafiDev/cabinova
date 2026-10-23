import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type TenantStatus } from "@/lib/tenants";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<TenantStatus, string> = {
	pending: "bg-zinc-100 text-zinc-600",
	provisioning: "bg-sky-50 text-sky-700",
	active: "bg-emerald-50 text-emerald-700",
	suspended: "bg-amber-50 text-amber-700",
	closure_pending: "bg-orange-50 text-orange-700",
	closed: "bg-red-50 text-red-700",
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
	return (
		<Badge variant="outline" className={cn("border-transparent", STATUS_TONES[status])}>
			{STATUS_LABELS[status]}
		</Badge>
	);
}
