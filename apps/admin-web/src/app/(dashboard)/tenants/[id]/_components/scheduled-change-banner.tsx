"use client";

import { CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { reasonLabel, STATUS_LABELS, type TenantStatusChange } from "@/lib/tenants";

/** A future-dated status change waiting for its effective date. */
export function ScheduledChangeBanner({
	tenantId,
	change,
	canCancel,
}: {
	tenantId: string;
	change: TenantStatusChange;
	canCancel: boolean;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	const cancel = () =>
		startTransition(async () => {
			try {
				await api(`/tenants/${tenantId}/status-changes/${change.id}`, { method: "DELETE" });
				toast.success("Changement programmé annulé");
				router.refresh();
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Annulation impossible");
			}
		});

	return (
		<div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
			<CalendarClock className="size-4 shrink-0" />
			<p className="min-w-0 flex-1">
				Passage à <strong>{STATUS_LABELS[change.toStatus]}</strong> programmé le{" "}
				<strong>{formatDate(change.effectiveAt)}</strong> — {reasonLabel(change.action, change.reason)}.
			</p>
			{canCancel && (
				<Button size="sm" variant="outline" onClick={cancel} disabled={pending}>
					Annuler le changement
				</Button>
			)}
		</div>
	);
}
