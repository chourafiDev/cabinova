"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { PAYMENT_KEYS } from "@/app/(clinic)/payments/_components/checkout-dialog";
import { IconCheckCircle, IconLock, IconPrinter, IconSpinner } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { formatFileNumber } from "@/lib/patients";
import { type Account, METHODS, type PaymentMethod } from "@/lib/payments";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/**
 * What the front desk needs to know about a finished visit: the acts the
 * doctor saved, the remboursement, what was paid, and above all how much to
 * take from the patient. Once the patient pays, "Payé" records it (the rest,
 * in full) and the receipt is ready to print.
 */
export function PaymentDetailDialog({
	appointmentId,
	onOpenChange,
}: {
	/** null: closed. */
	appointmentId: string | null;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={appointmentId !== null} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
				{appointmentId && <Detail appointmentId={appointmentId} onClose={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function Detail({ appointmentId, onClose }: { appointmentId: string; onClose: () => void }) {
	const t = useTranslations("agenda.seen.detail");
	const payments = useTranslations("payments");
	const format = useFormat();
	const { mad } = format;
	const queryClient = useQueryClient();
	const [method, setMethod] = useState<PaymentMethod>("cash");
	const [paying, setPaying] = useState(false);
	const { data: account, error } = useQuery({
		queryKey: ["account", appointmentId],
		queryFn: () => api<Account>(`/appointments/${appointmentId}/account`),
	});

	if (!account) {
		return (
			<div className="grid gap-4">
				<DialogHeader>
					<DialogTitle>{t("title")}</DialogTitle>
					<DialogDescription>{t("loading")}</DialogDescription>
				</DialogHeader>
				<Skeleton className="h-40" />
				{error && <p className="text-destructive text-sm">{error.message}</p>}
			</div>
		);
	}

	const { appointment: visit } = account;
	const name = `${visit.patient.firstName} ${visit.patient.lastName}`;
	const received = account.payments.filter((p) => !p.cancelledAt);
	const charged = account.chargeId !== null;
	const due = Math.max(0, account.balance);
	const payable = charged && due > 0;

	// The rest, in full: the acts stay as the doctor saved them.
	const markPaid = async () => {
		setPaying(true);
		try {
			const res = await api<Account>(`/appointments/${visit.id}/checkout`, {
				method: "POST",
				body: JSON.stringify({
					items: account.items.map(({ actId, label, unitPrice, quantity }) => ({
						actId: actId ?? undefined,
						label,
						unitPrice,
						quantity,
					})),
					payment: { amount: due, method },
				}),
			});
			queryClient.setQueryData(["account", visit.id], res);
			await Promise.all(PAYMENT_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
			toast.success(t("paidToast", { amount: mad(due), name }));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t("payError"));
		} finally {
			setPaying(false);
		}
	};

	return (
		<div className="grid gap-5">
			<DialogHeader>
				<DialogTitle>{t("titleFor", { name })}</DialogTitle>
				<DialogDescription>
					{visit.practitioner.name} · {formatFileNumber(visit.patient.fileNumber)}
				</DialogDescription>
			</DialogHeader>

			{/* The one number the desk needs, first. */}
			<div
				className={cn(
					"grid gap-0.5 rounded-xl border p-4 text-center",
					!charged || due > 0 ? "border-primary bg-primary/20 text-primary" : "border-emerald-200 bg-emerald-50 text-emerald-800",
				)}
			>
				<p className="text-xs font-medium">{!charged ? t("noActs") : due > 0 ? t("toCollect") : t("settled")}</p>
				{/* Settled: what was paid, rather than a "0 MAD". */}
				{charged && <p className="text-2xl font-semibold tabular-nums">{mad(due > 0 ? due : account.paid)}</p>}
				{!charged && <p className="text-xs">{t("noActsHint")}</p>}
				{account.balance < 0 && <p className="text-xs">{t("overpaid", { amount: mad(-account.balance) })}</p>}
			</div>

			{charged && (
				<section className="grid gap-2">
					<h3 className="text-sm font-medium">{t("acts")}</h3>
					<ul className="divide-y rounded-lg border text-sm">
						{account.items.map((item) => (
							<li key={item.id} className="flex items-center gap-3 px-3 py-2">
								<span className="min-w-0 flex-1 truncate">
									{item.label}
									{item.quantity > 1 && <span className="text-muted-foreground"> × {item.quantity}</span>}
								</span>
								<span className="tabular-nums">{mad(item.unitPrice * item.quantity)}</span>
							</li>
						))}
					</ul>
					<dl className="bg-muted/50 grid gap-1.5 rounded-lg p-3 text-sm">
						<Line label={t("actsTotal")} value={mad(account.subtotal)} />
						{account.discount > 0 && (
							<Line label={t("discount")} value={`− ${mad(account.discount)}`} className="text-emerald-700" />
						)}
						<Line label={t("patientPays")} value={mad(account.total)} strong={account.paid === 0} />
						{account.paid !== 0 && (
							<>
								<Line label={t("alreadyPaid")} value={mad(account.paid)} />
								<Line label={t("remaining")} value={mad(due)} strong />
							</>
						)}
					</dl>
				</section>
			)}

			{received.length > 0 && (
				<section className="grid gap-2">
					<h3 className="text-sm font-medium">{t("payments")}</h3>
					<ul className="divide-y rounded-lg border text-sm">
						{received.map((p) => (
							<li key={p.id} className="flex items-center gap-3 px-3 py-2">
								<div className="min-w-0 flex-1">
									<p className={cn("font-medium tabular-nums", p.kind === "refund" && "text-destructive")}>
										{p.kind === "refund" ? `− ${mad(p.amount)}` : mad(p.amount)}
										<span className="text-muted-foreground ms-1.5 font-normal">{payments(`methods.${p.method}`)}</span>
									</p>
									<p className="text-muted-foreground text-xs">
										{format.clock(p.receivedAt)}
										{p.receivedBy && ` · ${p.receivedBy}`}
										{p.receiptNumber && ` · ${p.receiptNumber}`}
									</p>
								</div>
								{p.kind === "payment" && (
									<Button asChild variant="ghost" size="icon-sm" aria-label={t("print")} title={t("print")}>
										<a href={`/receipts/${p.id}`} target="_blank" rel="noopener">
											<IconPrinter />
										</a>
									</Button>
								)}
							</li>
						))}
					</ul>
				</section>
			)}

			{payable && account.dayClosed && (
				<p className="bg-muted text-muted-foreground flex items-start gap-2 rounded-lg p-3 text-sm">
					<IconLock className="mt-0.5 size-4 shrink-0" />
					{t("locked")}
				</p>
			)}

			{payable && !account.dayClosed && (
				<section className="grid gap-2">
					<h3 className="text-sm font-medium">{t("method")}</h3>
					<div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("method")}>
						{METHODS.map((m) => (
							<button
								key={m.value}
								type="button"
								role="radio"
								aria-checked={method === m.value}
								onClick={() => setMethod(m.value)}
								className={cn(
									"h-8 rounded-lg border px-3 text-sm transition-colors",
									method === m.value
										? "border-primary bg-primary text-primary-foreground font-medium"
										: "bg-background text-muted-foreground hover:text-foreground",
								)}
							>
								{payments(`methods.${m.value}`)}
							</button>
						))}
					</div>
				</section>
			)}

			<DialogFooter>
				<Button variant="outline" onClick={onClose}>
					{t("close")}
				</Button>
				{payable && !account.dayClosed && (
					<Button onClick={markPaid} disabled={paying}>
						{paying ? <IconSpinner className="animate-spin" /> : <IconCheckCircle />} {t("markPaid", { amount: mad(due) })}
					</Button>
				)}
			</DialogFooter>
		</div>
	);
}

function Line({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
	return (
		<div className={cn("flex justify-between", strong && "border-t pt-1.5")}>
			<dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
			<dd className={cn("tabular-nums", strong && "font-semibold", className)}>{value}</dd>
		</div>
	);
}
