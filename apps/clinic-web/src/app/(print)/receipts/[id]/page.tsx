import type { Metadata } from "next";
import { formatDate } from "@/lib/format";
import { formatFileNumber } from "@/lib/patients";
import { mad, madInWords, METHOD_LABELS, type Receipt } from "@/lib/payments";
import { apiGet } from "@/lib/server-api";
import { PrintButton } from "./print-button";

export async function generateMetadata({ params }: PageProps<"/receipts/[id]">): Promise<Metadata> {
	const receipt = await apiGet<Receipt>(`/payments/${(await params).id}/receipt`);
	return { title: `Reçu ${receipt.receiptNumber}` };
}

const METHOD_PHRASES = {
	cash: "en espèces",
	card: "par carte bancaire",
	cheque: "par chèque",
	transfer: "par virement",
} as const;

/**
 * Reçu de paiement (print / save as PDF): the cabinet and the space, the
 * patient, the visit's acts and the amount received, in figures and words.
 */
export default async function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
	const { id } = await params;
	const r = await apiGet<Receipt>(`/payments/${id}/receipt`);
	const address = [r.space.address ?? r.cabinet.address, r.space.city ?? r.cabinet.city].filter(Boolean).join(", ");
	const phone = r.space.phone ?? r.cabinet.phone;
	const patient = `${r.patient.firstName} ${r.patient.lastName}`;

	return (
		<div className="mx-auto max-w-2xl px-4 print:max-w-none print:px-0">
			<div className="mb-4 flex justify-end print:hidden">
				<PrintButton />
			</div>
			<article className="paper relative overflow-hidden rounded-xl border bg-white p-10 text-sm text-zinc-900 shadow-sm print:rounded-none print:border-0 print:p-6 print:shadow-none">
				{r.cancelledAt && (
					<span className="absolute end-10 top-10 rotate-6 rounded-md border-2 border-red-600 px-3 py-1 text-base font-bold uppercase tracking-wider text-red-700">
						Annulé
					</span>
				)}

				<header className="mb-8 grid gap-0.5">
					<p className="text-lg font-bold">{r.cabinet.legalName ?? r.cabinet.name}</p>
					{r.cabinet.specialty && <p className="text-zinc-600">{r.cabinet.specialty}</p>}
					{address && <p className="text-zinc-600">{address}</p>}
					<p className="text-zinc-600">{[phone, r.cabinet.email].filter(Boolean).join(" · ")}</p>
				</header>

				<div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
					<h1 className="text-xl font-semibold">Reçu de paiement</h1>
					<div className="text-end">
						<p className="font-mono font-semibold">{r.receiptNumber}</p>
						<p className="text-zinc-600">{formatDate(r.receivedAt, { hour: "2-digit", minute: "2-digit" })}</p>
					</div>
				</div>

				<p className="mb-6 leading-relaxed">
					Reçu de <strong>{patient}</strong>
					<span className="text-zinc-600">
						{" "}
						({formatFileNumber(r.patient.fileNumber)}
						{r.patient.cin && ` · CIN ${r.patient.cin}`})
					</span>{" "}
					la somme de <strong>{mad(r.amount)}</strong> {METHOD_PHRASES[r.method]}
					{r.reference && ` (${r.reference})`}, pour la consultation du{" "}
					{formatDate(r.visit.startsAt)} avec {r.visit.name} :
				</p>

				<table className="mb-6 w-full tabular-nums">
					<thead>
						<tr className="border-b text-zinc-500">
							<th className="py-2 text-start font-normal">Acte</th>
							<th className="py-2 text-end font-normal">Qté</th>
							<th className="py-2 text-end font-normal">Prix unitaire</th>
							<th className="py-2 text-end font-normal">Montant</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{r.items.map((item, i) => (
							<tr key={i}>
								<td className="py-2">{item.label}</td>
								<td className="py-2 text-end">{item.quantity}</td>
								<td className="py-2 text-end">{mad(item.unitPrice)}</td>
								<td className="py-2 text-end">{mad(item.unitPrice * item.quantity)}</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr className="border-t">
							<td colSpan={3} className="py-2 text-end text-zinc-600">
								Total des actes
							</td>
							<td className="py-2 text-end">{mad(r.total)}</td>
						</tr>
						<tr>
							<td colSpan={3} className="py-1 text-end font-semibold">
								Montant reçu ({METHOD_LABELS[r.method].toLowerCase()})
							</td>
							<td className="py-1 text-end text-base font-semibold">{mad(r.amount)}</td>
						</tr>
					</tfoot>
				</table>

				<p className="mb-10 rounded-lg bg-zinc-50 p-3">
					Arrêté le présent reçu à la somme de <strong>{madInWords(r.amount)}</strong>.
				</p>

				<footer className="flex flex-wrap items-end justify-between gap-6 text-zinc-600">
					<p>{r.receivedBy && `Encaissé par ${r.receivedBy}`}</p>
					<div className="grid h-24 w-56 place-items-end rounded-lg border border-dashed p-2 text-xs text-zinc-500">
						Cachet et signature
					</div>
				</footer>
				{r.cancelledAt && (
					<p className="mt-6 text-xs text-red-700">
						Paiement annulé le {formatDate(r.cancelledAt)}
						{r.cancelledBy && ` par ${r.cancelledBy}`} : {r.cancelReason}
					</p>
				)}
			</article>
		</div>
	);
}
