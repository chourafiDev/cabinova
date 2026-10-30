"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuReceipt, LuWallet } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { mad, type PatientAccount } from "@/lib/payments";
import { cn } from "@/lib/utils";
import { CheckoutDialog } from "../../payments/_components/checkout-dialog";

const useAccount = (patientId: string) =>
	useQuery({
		queryKey: ["patient-account", patientId],
		queryFn: () => api<PatientAccount>(`/patients/${patientId}/account`),
	});

/** Overview: what the patient still owes, when anything. */
export function PatientBalance({ patientId }: { patientId: string }) {
	const { data } = useAccount(patientId);
	if (!data || data.balance <= 0) return null;
	return (
		<p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			<LuWallet className="size-4 shrink-0" />
			<span>
				Reste à payer : <strong className="tabular-nums">{mad(data.balance)}</strong>
			</span>
		</p>
	);
}

/** The patient's visits with acts in this space: amount, paid, still owed. */
export function PatientPayments({ patientId }: { patientId: string }) {
	const { data } = useAccount(patientId);
	const [checkout, setCheckout] = useState<string | null>(null);

	if (!data) return <Skeleton className="h-32" />;
	if (data.visits.length === 0) {
		return (
			<div className="flex flex-col items-center gap-3 py-12 text-center">
				<LuWallet className="text-muted-foreground size-6" />
				<p className="text-muted-foreground text-sm">Aucune visite encaissée pour ce patient.</p>
			</div>
		);
	}
	return (
		<div className="grid gap-4">
			<div className="flex items-baseline justify-between gap-3 rounded-xl border p-4">
				<span className="text-muted-foreground text-sm">Reste à payer</span>
				<span className={cn("text-xl font-semibold tabular-nums", data.balance > 0 && "text-amber-700 dark:text-amber-300")}>
					{mad(data.balance)}
				</span>
			</div>
			<ul className="divide-y">
				{data.visits.map((v) => (
					<li key={v.appointmentId} className="flex items-center gap-3 py-3">
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium">
								{formatDate(v.startsAt, { month: "short" })} · {v.practitioner}
							</p>
							<p className="text-muted-foreground truncate text-xs">{v.acts.join(", ")}</p>
						</div>
						<div className="text-end text-sm tabular-nums">
							<p className="font-medium">{mad(v.total)}</p>
							<p className={cn("text-xs", v.balance > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
								{v.balance > 0 ? `reste ${mad(v.balance)}` : v.balance < 0 ? `trop-perçu ${mad(-v.balance)}` : "réglé"}
							</p>
						</div>
						<Button size="sm" variant={v.balance > 0 ? "default" : "outline"} onClick={() => setCheckout(v.appointmentId)}>
							{v.balance > 0 ? (
								<>
									<LuReceipt /> Encaisser
								</>
							) : (
								"Voir"
							)}
						</Button>
					</li>
				))}
			</ul>
			<CheckoutDialog appointmentId={checkout} onOpenChange={(o) => !o && setCheckout(null)} />
		</div>
	);
}
