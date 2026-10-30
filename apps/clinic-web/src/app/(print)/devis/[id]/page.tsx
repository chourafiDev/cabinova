import type { Metadata } from "next";
import type { QuoteDocument } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { apiGet } from "@/lib/server-api";
import { AmountTable, BillingDocument, TransferDetails } from "../../_components/document";

export async function generateMetadata({ params }: PageProps<"/devis/[id]">): Promise<Metadata> {
	const quote = await apiGet<QuoteDocument>(`/billing/quotes/${(await params).id}`);
	return { title: `Devis ${quote.number}` };
}

/** Devis (print / save as PDF): what to pay, how, and where to send the proof. */
export default async function QuotePage({ params }: PageProps<"/devis/[id]">) {
	const { id } = await params;
	const q = await apiGet<QuoteDocument>(`/billing/quotes/${id}`);
	return (
		<BillingDocument
			kind="Devis"
			number={q.number}
			party={q}
			dates={[
				["Émis le", formatDate(q.issuedAt)],
				["À régler avant", formatDate(q.dueAt)],
			]}
			stamp={
				q.status === "paid"
					? { label: "Payé", className: "border-emerald-600 text-emerald-700" }
					: q.status === "void"
						? { label: "Annulé", className: "border-zinc-400 text-zinc-500" }
						: undefined
			}
		>
			<AmountTable description={q.description} amount={q.amount} totalLabel="Total à payer" />
			{q.status === "pending" && (
				<>
					<TransferDetails issuer={q.issuer} reference={q.number} />
					<p className="mt-4 text-zinc-600">
						Une fois le virement effectué, envoyez votre avis de virement
						{q.proofEmail ? (
							<>
								{" "}
								à <strong className="text-zinc-900">{q.proofEmail}</strong>
							</>
						) : (
							" en réponse à l’e-mail du devis"
						)}
						. Nous créons alors votre facture et votre abonnement démarre.
					</p>
				</>
			)}
			<p className="mt-4 text-xs text-zinc-500">Ce devis n’est pas une facture. La facture est émise à réception du paiement.</p>
		</BillingDocument>
	);
}
