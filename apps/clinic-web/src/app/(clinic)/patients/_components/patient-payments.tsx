"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuReceipt, LuWallet } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import type { PatientAccount } from "@/lib/payments";
import { useFormat } from "@/lib/use-format";
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
	const t = useTranslations("patients.account");
	const format = useFormat();
	if (!data || data.balance <= 0) return null;
	return (
		<p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			<LuWallet className="size-4 shrink-0" />
			<span>
				{t("due")} <strong className="tabular-nums">{format.mad(data.balance)}</strong>
			</span>
		</p>
	);
}

/** The patient's visits with acts in this space: amount, paid, still owed. */
export function PatientPayments({ patientId }: { patientId: string }) {
	const { data } = useAccount(patientId);
	const [checkout, setCheckout] = useState<string | null>(null);
	const t = useTranslations("patients.account");
	const format = useFormat();

	if (!data) return <Skeleton className="h-32" />;
	if (data.visits.length === 0) {
		return (
			<div className="flex flex-col items-center gap-3 py-12 text-center">
				<LuWallet className="text-muted-foreground size-6" />
				<p className="text-muted-foreground text-sm">{t("noVisits")}</p>
			</div>
		);
	}
	return (
		<div className="grid gap-4">
			<div className="flex items-baseline justify-between gap-3 rounded-xl border p-4">
				<span className="text-muted-foreground text-sm">{t("dueTitle")}</span>
				<span className={cn("text-xl font-semibold tabular-nums", data.balance > 0 && "text-amber-700 dark:text-amber-300")}>
					{format.mad(data.balance)}
				</span>
			</div>
			<ul className="divide-y">
				{data.visits.map((v) => (
					<li key={v.appointmentId} className="flex items-center gap-3 py-3">
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium">
								{format.date(v.startsAt, { month: "short" })} · {v.practitioner}
							</p>
							<p className="text-muted-foreground truncate text-xs">{v.acts.join(", ")}</p>
						</div>
						<div className="text-end text-sm tabular-nums">
							<p className="font-medium">{format.mad(v.total)}</p>
							<p className={cn("text-xs", v.balance > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
								{v.balance > 0
									? t("remaining", { amount: format.mad(v.balance) })
									: v.balance < 0
										? t("overpaid", { amount: format.mad(-v.balance) })
										: t("settled")}
							</p>
						</div>
						<Button size="sm" variant={v.balance > 0 ? "default" : "outline"} onClick={() => setCheckout(v.appointmentId)}>
							{v.balance > 0 ? (
								<>
									<LuReceipt /> {t("collect")}
								</>
							) : (
								t("view")
							)}
						</Button>
					</li>
				))}
			</ul>
			<CheckoutDialog appointmentId={checkout} onOpenChange={(o) => !o && setCheckout(null)} />
		</div>
	);
}
