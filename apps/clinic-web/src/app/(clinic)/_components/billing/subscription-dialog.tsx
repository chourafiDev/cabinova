"use client";

import { Check, Copy, Loader, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { formatDate, formatMad } from "@/lib/format";

/** GET /billing/summary (clinic-api), responsible doctor only. */
type BillingSummary = {
	plan: string | null;
	billingPeriod: "monthly" | "annual" | null;
	status: "trialing" | "active" | "past_due" | "cancelled" | null;
	trialEndsAt: string | null;
	currentPeriodEnd: string | null;
	nextAmount: number | null;
	openInvoice: { number: string; amount: number; dueAt: string; status: "billed" | "overdue" } | null;
	payTo: {
		companyName: string | null;
		accountHolder: string | null;
		bankName: string | null;
		rib: string;
		swift: string | null;
	} | null;
};

const PERIOD = { monthly: "mois", annual: "an" } as const;

/** "000000000000000000000000" → "000 000 0000000000000000 00" (Moroccan RIB layout). */
const formatRib = (rib: string) =>
	rib.length === 24 ? `${rib.slice(0, 3)} ${rib.slice(3, 6)} ${rib.slice(6, 22)} ${rib.slice(22)}` : rib;

function CopyButton({ value, label }: { value: string; label: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<Button
			size="icon"
			variant="ghost"
			className="size-7"
			aria-label={`Copier ${label}`}
			onClick={() =>
				navigator.clipboard
					.writeText(value)
					.then(() => {
						setCopied(true);
						setTimeout(() => setCopied(false), 1500);
					})
					.catch(() => toast.error("Copie impossible : sélectionnez le texte."))
			}
		>
			{copied ? <Check /> : <Copy />}
		</Button>
	);
}

/** Offer, price after the trial, the invoice waiting and where to send the transfer. */
export function SubscriptionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const [summary, setSummary] = useState<BillingSummary | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		api<BillingSummary>("/billing/summary")
			.then((s) => !cancelled && setSummary(s))
			.catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Chargement impossible"));
		return () => {
			cancelled = true;
		};
	}, [open]);

	const s = summary;
	const invoice = s?.openInvoice;
	const reference = invoice?.number;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Votre abonnement</DialogTitle>
					<DialogDescription>Paiement par virement bancaire, facture envoyée par e-mail.</DialogDescription>
				</DialogHeader>

				{!s && !error && (
					<p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
						<Loader className="size-4 animate-spin" /> Chargement…
					</p>
				)}
				{error && <p className="text-destructive py-4 text-sm">{error}</p>}

				{s && (
					<div className="grid gap-4 text-sm">
						<div className="rounded-xl border p-4">
							<p className="text-muted-foreground text-xs">Votre offre</p>
							<p className="mt-0.5 flex items-baseline justify-between gap-2">
								<span className="text-base font-semibold">{s.plan ? `Offre ${s.plan}` : "Aucune offre"}</span>
								{s.nextAmount !== null && s.billingPeriod && (
									<span className="font-semibold tabular-nums">
										{formatMad(s.nextAmount)}
										<span className="text-muted-foreground font-normal"> / {PERIOD[s.billingPeriod]}</span>
									</span>
								)}
							</p>
							{s.status === "trialing" && s.trialEndsAt && (
								<p className="text-muted-foreground mt-2">
									Essai gratuit jusqu’au <span className="text-foreground">{formatDate(s.trialEndsAt)}</span>. Ce
									jour-là, vous recevez la première facture par e-mail, à régler par virement.
								</p>
							)}
						</div>

						{invoice && (
							<div className="rounded-xl border p-4">
								<p className="text-muted-foreground text-xs">
									{invoice.status === "overdue" ? "Facture en retard" : "Facture à régler"}
								</p>
								<p className="mt-0.5 flex items-baseline justify-between gap-2">
									<span className="font-semibold">{invoice.number}</span>
									<span className="font-semibold tabular-nums">{formatMad(invoice.amount)}</span>
								</p>
								<p className="text-muted-foreground mt-1">Échéance : {formatDate(invoice.dueAt)}</p>
							</div>
						)}

						{s.payTo ? (
							<div className="rounded-xl border p-4">
								<p className="text-muted-foreground mb-2 text-xs">Virement à</p>
								<dl className="grid gap-1.5">
									{s.payTo.accountHolder && (
										<div className="flex justify-between gap-3">
											<dt className="text-muted-foreground">Titulaire</dt>
											<dd className="text-end">{s.payTo.accountHolder}</dd>
										</div>
									)}
									{s.payTo.bankName && (
										<div className="flex justify-between gap-3">
											<dt className="text-muted-foreground">Banque</dt>
											<dd className="text-end">{s.payTo.bankName}</dd>
										</div>
									)}
									<div className="flex items-center justify-between gap-3">
										<dt className="text-muted-foreground">RIB</dt>
										<dd className="flex items-center gap-1 font-mono text-xs">
											{formatRib(s.payTo.rib)}
											<CopyButton value={s.payTo.rib} label="le RIB" />
										</dd>
									</div>
									{reference && (
										<div className="flex items-center justify-between gap-3">
											<dt className="text-muted-foreground">Référence</dt>
											<dd className="flex items-center gap-1 font-mono text-xs">
												{reference}
												<CopyButton value={reference} label="la référence" />
											</dd>
										</div>
									)}
								</dl>
								{reference && (
									<p className="text-muted-foreground mt-2 text-xs">
										Indiquez la référence dans le libellé du virement : votre paiement est reconnu plus vite.
									</p>
								)}
							</div>
						) : (
							invoice && (
								<p className="text-muted-foreground text-xs">
									Les coordonnées bancaires figurent sur la facture reçue par e-mail.
								</p>
							)
						)}

						<Button asChild variant="outline" className="w-full">
							<a href="mailto:support@cabinova.ma?subject=Changer%20d%E2%80%99offre">
								<Mail /> Changer d’offre ? Écrivez-nous
							</a>
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
