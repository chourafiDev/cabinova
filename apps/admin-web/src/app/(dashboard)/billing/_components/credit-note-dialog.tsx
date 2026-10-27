"use client";

import { format } from "date-fns";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import type { Invoice, InvoiceDetail } from "@/lib/billing";
import { formatPrice } from "@/lib/plans";
import { cn } from "@/lib/utils";

const toCentimes = (v: string) => Math.round(Number(v.replace(/\s/g, "").replace(",", ".")) * 100);
const toMad = (c: number) => (c / 100).toFixed(2).replace(".", ",");

/**
 * Avoir on a paid invoice: money sent back by transfer, or a credit the
 * next invoices deduct automatically. Partial amounts allowed, up to what
 * was paid and not yet credited.
 */
export function CreditNoteDialog({
	invoice,
	onOpenChange,
}: {
	invoice: Invoice;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const [creditable, setCreditable] = useState<number | null>(null);
	const [kind, setKind] = useState<"credit" | "refund">("credit");
	const [amount, setAmount] = useState("");
	const [reason, setReason] = useState("");
	const [refundedAt, setRefundedAt] = useState(format(new Date(), "yyyy-MM-dd"));
	const [reference, setReference] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		api<InvoiceDetail>(`/billing/invoices/${invoice.id}`)
			.then((d) => {
				setCreditable(d.creditable);
				setAmount(toMad(d.creditable));
			})
			.catch(() => setCreditable(0));
	}, [invoice.id]);

	const cents = toCentimes(amount);
	const save = async () => {
		if (!Number.isFinite(cents) || cents <= 0) return setError("Montant invalide");
		if (creditable !== null && cents > creditable) return setError(`Au plus ${formatPrice(creditable)}`);
		if (reason.trim().length < 3) return setError("Indiquez le motif");
		setSaving(true);
		setError(null);
		try {
			const note = await api<{ number: string }>(`/billing/invoices/${invoice.id}/credit-notes`, {
				method: "POST",
				body: JSON.stringify({
					kind,
					amount: cents,
					reason,
					...(kind === "refund" && { refundedAt, refundReference: reference || undefined }),
				}),
			});
			toast.success(`Avoir ${note.number} émis`, {
				description:
					kind === "refund" ? "Remboursement enregistré." : "Il sera déduit des prochaines factures du cabinet.",
			});
			onOpenChange(false);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Émission impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Avoir sur la facture {invoice.number}</DialogTitle>
					<DialogDescription>
						{invoice.tenant.name} · payée {formatPrice(invoice.amount)}. La facture garde son numéro et son montant.
					</DialogDescription>
				</DialogHeader>
				{creditable === null ? (
					<Loader className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />
				) : creditable === 0 ? (
					<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
						Rien à créditer : le montant payé a déjà fait l’objet d’avoirs (ou a été réglé par un avoir).
					</p>
				) : (
					<div className="grid gap-4">
						<div className="grid grid-cols-2 gap-2" role="radiogroup">
							{(
								[
									["credit", "Créditer", "Déduit des prochaines factures"],
									["refund", "Rembourser", "Virement renvoyé au cabinet"],
								] as const
							).map(([k, label, hint]) => (
								<button
									key={k}
									type="button"
									role="radio"
									aria-checked={kind === k}
									onClick={() => setKind(k)}
									className={cn(
										"grid gap-0.5 rounded-lg border p-2.5 text-start hover:bg-muted/50",
										kind === k && "border-primary bg-primary/5 ring-1 ring-primary",
									)}
								>
									<span className="text-sm font-medium">{label}</span>
									<span className="text-[11px] text-muted-foreground">{hint}</span>
								</button>
							))}
						</div>
						<Field data-invalid={!!error && error.includes("Montant")}>
							<FieldLabel htmlFor="cn-amount">Montant (MAD)</FieldLabel>
							<Input id="cn-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
							<FieldDescription>
								Jusqu’à {formatPrice(creditable)}.
								{cents < creditable && cents > 0 && " Avoir partiel."}
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="cn-reason">Motif</FieldLabel>
							<Input
								id="cn-reason"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								placeholder="Geste commercial, double paiement, erreur de tarif…"
							/>
						</Field>
						{kind === "refund" && (
							<div className="grid gap-4 sm:grid-cols-2">
								<Field>
									<FieldLabel htmlFor="cn-date">Virement envoyé le</FieldLabel>
									<Input id="cn-date" type="date" value={refundedAt} onChange={(e) => setRefundedAt(e.target.value)} />
								</Field>
								<Field>
									<FieldLabel htmlFor="cn-ref">Référence</FieldLabel>
									<Input id="cn-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Facultatif" />
								</Field>
							</div>
						)}
						<FieldError>{error}</FieldError>
					</div>
				)}
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Annuler
					</Button>
					<Button onClick={save} disabled={saving || !creditable}>
						{saving && <Loader className="animate-spin" />} Émettre l’avoir
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
