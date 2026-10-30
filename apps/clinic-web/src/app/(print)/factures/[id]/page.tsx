import type { Metadata } from "next";
import type { InvoiceDocument } from "@/lib/billing";
import { formatDate, formatMad } from "@/lib/format";
import { apiGet } from "@/lib/server-api";
import { AmountTable, BillingDocument, TransferDetails } from "../../_components/document";

export async function generateMetadata({ params }: PageProps<"/factures/[id]">): Promise<Metadata> {
	const invoice = await apiGet<InvoiceDocument>(`/billing/invoices/${(await params).id}`);
	return { title: `Facture ${invoice.number}` };
}

const STAMPS: Partial<Record<InvoiceDocument["status"], { label: string; className: string }>> = {
	paid: { label: "Payée", className: "border-emerald-600 text-emerald-700" },
	overdue: { label: "En retard", className: "border-red-600 text-red-700" },
	void: { label: "Annulée", className: "border-zinc-400 text-zinc-500" },
	refunded: { label: "Remboursée", className: "border-zinc-400 text-zinc-500" },
};

/** Facture from Cabinova (print / save as PDF). */
export default async function InvoicePage({ params }: PageProps<"/factures/[id]">) {
	const { id } = await params;
	const i = await apiGet<InvoiceDocument>(`/billing/invoices/${id}`);
	const open = i.status === "billed" || i.status === "overdue";
	return (
		<BillingDocument
			kind="Facture"
			number={i.number}
			party={i}
			dates={[
				["Émise le", formatDate(i.issuedAt)],
				i.paidAt ? ["Payée le", formatDate(i.paidAt)] : ["Échéance", formatDate(i.dueAt)],
			]}
			stamp={STAMPS[i.status]}
		>
			<AmountTable
				description={i.description}
				amount={i.amount}
				credit={i.creditApplied}
				totalLabel={open ? "Total à payer" : "Total"}
			/>
			{open && <TransferDetails issuer={i.issuer} reference={i.number} />}
			{i.payments.length > 0 && (
				<section className="mt-6">
					<p className="mb-2 font-semibold">Paiements reçus</p>
					<ul className="grid gap-1 text-zinc-600">
						{i.payments.map((p) => (
							<li key={p.id}>
								{formatDate(p.receivedAt)} — {formatMad(p.amount)} par virement
								{p.reference && ` (réf. ${p.reference})`}
							</li>
						))}
					</ul>
				</section>
			)}
		</BillingDocument>
	);
}
