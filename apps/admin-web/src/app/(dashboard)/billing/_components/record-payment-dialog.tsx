"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import type { Invoice } from "@/lib/billing";
import { formatPrice } from "@/lib/plans";

const toCentimes = (v: string) => Math.round(Number(v.replace(/\s/g, "").replace(",", ".")) * 100);

/**
 * A transfer seen on the bank statement: amount, the date it arrived and the
 * bank reference, to reconcile later. Pays the invoice and extends the
 * cabinet's paid period; the client gets a receipt by e-mail.
 */
export function RecordPaymentDialog({
	invoice,
	open,
	onOpenChange,
}: {
	invoice: Invoice;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const [amount, setAmount] = useState((invoice.amount / 100).toFixed(2).replace(".", ","));
	const [receivedAt, setReceivedAt] = useState(format(new Date(), "yyyy-MM-dd"));
	const [reference, setReference] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const save = async () => {
		const cents = toCentimes(amount);
		if (!Number.isFinite(cents) || cents <= 0) {
			setError("Montant invalide");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const result = await api<{ tenantSuspended: boolean }>(`/billing/invoices/${invoice.id}/payments`, {
				method: "POST",
				body: JSON.stringify({ amount: cents, receivedAt, reference, note }),
			});
			onOpenChange(false);
			router.refresh();
			if (result.tenantSuspended) {
				toast.success(`Virement enregistré — ${invoice.tenant.name} est suspendu`, {
					description: "Réactivez le cabinet depuis sa fiche (Statut → Réactiver).",
					action: { label: "Ouvrir", onClick: () => router.push(`/tenants/${invoice.tenantId}`) },
				});
			} else {
				toast.success(`Virement enregistré, facture ${invoice.number} payée`);
			}
		} catch (err) {
			setError(err instanceof ApiError || err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Enregistrer le virement</DialogTitle>
					<DialogDescription>
						Facture <span className="font-medium text-foreground">{invoice.number}</span> ·{" "}
						<Link href={`/tenants/${invoice.tenantId}`} className="hover:underline">
							{invoice.tenant.name}
						</Link>{" "}
						· {formatPrice(invoice.amount)}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={!!error}>
							<FieldLabel htmlFor="pay-amount">Montant reçu (MAD)</FieldLabel>
							<Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor="pay-date">Reçu le</FieldLabel>
							<Input id="pay-date" type="date" value={receivedAt} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setReceivedAt(e.target.value)} />
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor="pay-ref">Référence bancaire</FieldLabel>
						<Input id="pay-ref" placeholder="Libellé ou n° du virement sur le relevé" value={reference} onChange={(e) => setReference(e.target.value)} />
						<FieldDescription>Pour retrouver le virement sur votre relevé.</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="pay-note">Note (facultatif)</FieldLabel>
						<Textarea id="pay-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
					</Field>
					{error && <FieldError errors={[{ message: error }]} />}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Annuler
					</Button>
					<Button onClick={save} disabled={saving}>
						Confirmer le paiement
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
