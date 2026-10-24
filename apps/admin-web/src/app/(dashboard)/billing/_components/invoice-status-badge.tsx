import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_TONES, type InvoiceStatus } from "@/lib/billing";
import { cn } from "@/lib/utils";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
	return (
		<Badge variant="outline" className={cn("border-transparent", INVOICE_STATUS_TONES[status])}>
			{INVOICE_STATUS_LABELS[status]}
		</Badge>
	);
}
