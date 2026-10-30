"use client";

import { format } from "date-fns";
import { LuEllipsis, LuPrinter, LuX } from "react-icons/lu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { BILLING_PERIOD_LABELS, formatPrice } from "@/lib/plans";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES, type Quote } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const day = (v: string) => formatDate(v, { month: "short" });
const toCentimes = (v: string) => Math.round(Number(v.replace(/\s/g, "").replace(",", ".")) * 100);

/**
 * Devis waiting for the cabinet's transfer. "Paiement reçu" is the moment
 * the fiche de paiement arrives by e-mail: it creates the facture, sends it
 * to the cabinet and starts the plan.
 */
export function QuotesTable({
	quotes,
	canWrite,
	showTenant = true,
}: {
	quotes: Quote[];
	canWrite: boolean;
	showTenant?: boolean;
}) {
	const router = useRouter();
	const [paying, setPaying] = useState<Quote | null>(null);
	const [voiding, setVoiding] = useState<Quote | null>(null);
	const [reason, setReason] = useState("");

	if (!quotes.length) {
		return <p className="py-8 text-center text-sm text-muted-foreground">Aucun devis.</p>;
	}

	const th = "px-3 py-2 text-start text-xs font-normal text-muted-foreground";
	const td = "px-3 py-2.5 align-middle";

	return (
		<>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[720px] text-sm">
					<thead>
						<tr className="border-b">
							<th className={th}>Devis</th>
							{showTenant && <th className={th}>Cabinet</th>}
							<th className={th}>Offre</th>
							<th className={cn(th, "text-end")}>Montant</th>
							<th className={th}>À régler avant</th>
							<th className={th}>Statut</th>
							<th className="w-0" />
						</tr>
					</thead>
					<tbody className="divide-y">
						{quotes.map((q) => {
							const pending = q.status === "pending";
							const late = pending && new Date(q.dueAt) < new Date();
							return (
								<tr key={q.id} className={cn(q.status === "void" && "text-muted-foreground")}>
									<td className={cn(td, "whitespace-nowrap font-medium tabular-nums")}>{q.number}</td>
									{showTenant && (
										<td className={td}>
											<Link href={`/tenants/${q.tenantId}?tab=subscription`} className="hover:underline">
												{q.tenant.name}
											</Link>
										</td>
									)}
									<td className={cn(td, "whitespace-nowrap text-muted-foreground")}>
										{q.planName}, {BILLING_PERIOD_LABELS[q.billingPeriod].toLowerCase()}
									</td>
									<td className={cn(td, "text-end font-medium tabular-nums")}>{formatPrice(q.amount)}</td>
									<td className={cn(td, "whitespace-nowrap", late && "text-red-700")}>
										{q.status === "paid" && q.paidAt
											? `Payé le ${day(q.paidAt)}`
											: pending
												? day(q.dueAt)
												: "—"}
									</td>
									<td className={cn(td, "whitespace-nowrap")}>
										<Badge variant="outline" className={cn("border-transparent", QUOTE_STATUS_TONES[q.status])}>
											{QUOTE_STATUS_LABELS[q.status]}
										</Badge>
										{q.invoiceNumber && (
											<span className="ms-2 text-xs text-muted-foreground tabular-nums">{q.invoiceNumber}</span>
										)}
									</td>
									<td className={cn(td, "whitespace-nowrap text-end")}>
										<div className="flex items-center justify-end gap-1">
											{pending && canWrite && (
												<Button size="sm" onClick={() => setPaying(q)}>
													Paiement reçu
												</Button>
											)}
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button size="icon-sm" variant="ghost" aria-label={`Actions ${q.number}`}>
														<LuEllipsis />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="w-48">
													<DropdownMenuItem asChild>
														<a href={`/quotes/${q.id}`} target="_blank" rel="noreferrer">
															<LuPrinter /> Voir / imprimer
														</a>
													</DropdownMenuItem>
													{pending && canWrite && (
														<DropdownMenuItem
															variant="destructive"
															onSelect={() => {
																setReason("");
																setVoiding(q);
															}}
														>
															<LuX /> Annuler le devis
														</DropdownMenuItem>
													)}
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{paying && <ConfirmDialog quote={paying} onClose={() => setPaying(null)} />}

			<Dialog open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Annuler le devis {voiding?.number} ?</DialogTitle>
						<DialogDescription>
							Il reste dans l’historique. Envoyez ensuite un nouveau devis depuis l’onglet Abonnement du cabinet, ou le
							médecin peut en demander un depuis son espace.
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor="void-quote-reason">Motif</FieldLabel>
						<Input
							id="void-quote-reason"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="Montant erroné, offre à revoir…"
						/>
					</Field>
					<DialogFooter>
						<Button variant="outline" onClick={() => setVoiding(null)}>
							Retour
						</Button>
						<Button
							variant="destructive"
							disabled={reason.trim().length < 3}
							onClick={async () => {
								try {
									await api(`/billing/quotes/${voiding!.id}/void`, {
										method: "POST",
										body: JSON.stringify({ reason }),
									});
									toast.success(`Devis ${voiding!.number} annulé`);
									setVoiding(null);
									router.refresh();
								} catch (err) {
									toast.error(err instanceof Error ? err.message : "Annulation impossible");
								}
							}}
						>
							Annuler le devis
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function ConfirmDialog({ quote, onClose }: { quote: Quote; onClose: () => void }) {
	const router = useRouter();
	const [amount, setAmount] = useState((quote.amount / 100).toFixed(2).replace(".", ","));
	const [receivedAt, setReceivedAt] = useState(format(new Date(), "yyyy-MM-dd"));
	const [reference, setReference] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const save = async () => {
		const cents = toCentimes(amount);
		if (!Number.isFinite(cents) || cents < 0) {
			setError("Montant invalide");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const result = await api<{ reactivated: boolean }>(`/billing/quotes/${quote.id}/confirm`, {
				method: "POST",
				body: JSON.stringify({ amount: cents, receivedAt, reference, note }),
			});
			onClose();
			router.refresh();
			toast.success(`Facture créée et envoyée à ${quote.tenant.name}`, {
				description: result.reactivated
					? "L’abonnement est actif et l’accès au cabinet est rétabli."
					: "L’abonnement est actif.",
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Paiement reçu</DialogTitle>
					<DialogDescription>
						Devis <span className="font-medium text-foreground">{quote.number}</span> · {quote.tenant.name} ·{" "}
						{formatPrice(quote.amount)}. La facture est créée, envoyée au cabinet, et l’abonnement {quote.planName}{" "}
						démarre.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<Field data-invalid={!!error}>
							<FieldLabel htmlFor="quote-amount">Montant reçu (MAD)</FieldLabel>
							<Input id="quote-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor="quote-date">Reçu le</FieldLabel>
							<Input
								id="quote-date"
								type="date"
								value={receivedAt}
								max={format(new Date(), "yyyy-MM-dd")}
								onChange={(e) => setReceivedAt(e.target.value)}
							/>
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor="quote-ref">Référence bancaire</FieldLabel>
						<Input
							id="quote-ref"
							placeholder="Libellé ou n° du virement sur le relevé"
							value={reference}
							onChange={(e) => setReference(e.target.value)}
						/>
						<FieldDescription>Vérifiez-la sur la fiche de paiement reçue par e-mail.</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="quote-note">Note (facultatif)</FieldLabel>
						<Textarea id="quote-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
					</Field>
					{error && <FieldError errors={[{ message: error }]} />}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Annuler
					</Button>
					<Button onClick={save} disabled={saving}>
						Créer la facture
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
