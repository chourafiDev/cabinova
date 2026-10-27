"use client";

import { MoreHorizontal, Printer, ReceiptText, X } from "lucide-react";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import type { Invoice } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { formatPrice } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { CreditNoteDialog } from "./credit-note-dialog";
import { RecordPaymentDialog } from "./record-payment-dialog";

const day = (v: string) => formatDate(v, { month: "short" });

/**
 * Invoices with their actions. Unpaid ones get "Enregistrer le virement" —
 * the daily task: match a transfer on the bank statement to its invoice.
 */
export function InvoicesTable({
	invoices,
	canWrite,
	showTenant = true,
}: {
	invoices: Invoice[];
	canWrite: boolean;
	showTenant?: boolean;
}) {
	const router = useRouter();
	const [paying, setPaying] = useState<Invoice | null>(null);
	const [voiding, setVoiding] = useState<Invoice | null>(null);
	const [crediting, setCrediting] = useState<Invoice | null>(null);
	const [reason, setReason] = useState("");

	if (!invoices.length) {
		return (
			<p className="py-8 text-center text-sm text-muted-foreground">
				Aucune facture.
			</p>
		);
	}

	const th = "px-3 py-2 text-start text-xs font-normal text-muted-foreground";
	const td = "px-3 py-2.5 align-middle";

	return (
		<>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[720px] text-sm">
					<thead>
						<tr className="border-b">
							<th className={th}>Facture</th>
							{showTenant && <th className={th}>Cabinet</th>}
							<th className={th}>Période</th>
							<th className={cn(th, "text-end")}>Montant</th>
							<th className={th}>Échéance</th>
							<th className={th}>Statut</th>
							<th className="w-0" />
						</tr>
					</thead>
					<tbody className="divide-y">
						{invoices.map((inv) => {
							const open = inv.status === "billed" || inv.status === "overdue";
							return (
								<tr
									key={inv.id}
									className={cn(
										inv.status === "void" && "text-muted-foreground",
									)}
								>
									<td
										className={cn(
											td,
											"whitespace-nowrap font-medium tabular-nums",
										)}
									>
										{inv.number}
									</td>
									{showTenant && (
										<td className={td}>
											<Link
												href={`/tenants/${inv.tenantId}?tab=subscription`}
												className="hover:underline"
											>
												{inv.tenant.name}
											</Link>
										</td>
									)}
									<td
										className={cn(
											td,
											"whitespace-nowrap text-muted-foreground",
										)}
									>
										{day(inv.periodStart)} → {day(inv.periodEnd)}
									</td>
									<td className={cn(td, "text-end font-medium tabular-nums")}>
										{formatPrice(inv.amount)}
									</td>
									<td
										className={cn(
											td,
											"whitespace-nowrap",
											inv.status === "overdue" && "text-red-700",
										)}
									>
										{inv.status === "paid" && inv.paidAt
											? `Payée le ${day(inv.paidAt)}`
											: day(inv.dueAt)}
									</td>
									<td className={td}>
										<InvoiceStatusBadge status={inv.status} />
									</td>
									<td className={cn(td, "whitespace-nowrap text-end")}>
										<div className="flex items-center justify-end gap-1">
											{open && canWrite && (
												<Button size="sm" onClick={() => setPaying(inv)}>
													Enregistrer le virement
												</Button>
											)}
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														size="icon-sm"
														variant="ghost"
														aria-label={`Actions ${inv.number}`}
													>
														<MoreHorizontal />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="w-48">
													<DropdownMenuItem asChild>
														<a
															href={`/invoices/${inv.id}`}
															target="_blank"
															rel="noreferrer"
														>
															<Printer /> Voir / imprimer
														</a>
													</DropdownMenuItem>
													{inv.status === "paid" && canWrite && (
														<DropdownMenuItem onSelect={() => setCrediting(inv)}>
															<ReceiptText /> Émettre un avoir
														</DropdownMenuItem>
													)}
													{open && canWrite && (
														<DropdownMenuItem
															variant="destructive"
															onSelect={() => {
																setReason("");
																setVoiding(inv);
															}}
														>
															<X /> Annuler la facture
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

			{crediting && <CreditNoteDialog invoice={crediting} onOpenChange={(o) => !o && setCrediting(null)} />}

			{paying && (
				<RecordPaymentDialog
					invoice={paying}
					open
					onOpenChange={(o) => !o && setPaying(null)}
				/>
			)}

			<Dialog open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Annuler la facture {voiding?.number} ?</DialogTitle>
						<DialogDescription>
							Elle reste dans l’historique (son numéro n’est jamais réutilisé).
							Émettez ensuite une nouvelle facture depuis l’onglet Abonnement du
							cabinet si besoin.
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor="void-reason">Motif</FieldLabel>
						<Input
							id="void-reason"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="Montant erroné, doublon…"
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
									await api(`/billing/invoices/${voiding!.id}/void`, {
										method: "POST",
										body: JSON.stringify({ reason }),
									});
									toast.success(`Facture ${voiding!.number} annulée`);
									setVoiding(null);
									router.refresh();
								} catch (err) {
									toast.error(
										err instanceof Error
											? err.message
											: "Annulation impossible",
									);
								}
							}}
						>
							Annuler la facture
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
