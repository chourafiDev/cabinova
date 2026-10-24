import { notFound } from "next/navigation";
import { formatRib, INVOICE_STATUS_LABELS, type InvoiceDetail } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { formatPrice } from "@/lib/plans";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { PrintButton } from "./print-button";

export async function generateMetadata({ params }: PageProps<"/invoices/[id]">) {
	const invoice = await apiGet<InvoiceDetail>(`/billing/invoices/${(await params).id}`);
	return { title: `Facture ${invoice.number}` };
}

const long = (v: string) => formatDate(v);

/**
 * Module 3 — the invoice as a document (print / save as PDF). Shows the
 * issuer, the cabinet, the line, the RIB with the reference to put on the
 * transfer, and the payments received.
 */
export default async function InvoicePrintPage({ params }: PageProps<"/invoices/[id]">) {
	const { id } = await params;
	const session = await getSession();
	if (!session || !can(session.user.permissions, "billing:read")) notFound();
	const invoice = await apiGet<InvoiceDetail>(`/billing/invoices/${id}`);
	const issuer = invoice.issuer.configured ? invoice.issuer : null;
	const t = invoice.tenant;

	return (
		<div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
			<div className="mb-4 flex justify-end print:hidden">
				<PrintButton />
			</div>
			<article className="relative overflow-hidden rounded-xl border bg-white p-10 text-sm text-zinc-900 shadow-sm print:rounded-none print:border-0 print:shadow-none">
				{invoice.status !== "billed" && (
					<span
						className={cn(
							"absolute end-10 top-10 rotate-6 rounded-md border-2 px-3 py-1 text-base font-bold uppercase tracking-wider",
							invoice.status === "paid" && "border-emerald-600 text-emerald-700",
							invoice.status === "overdue" && "border-red-600 text-red-700",
							(invoice.status === "void" || invoice.status === "refunded") && "border-zinc-400 text-zinc-500",
						)}
					>
						{INVOICE_STATUS_LABELS[invoice.status]}
					</span>
				)}

				<header className="mb-10 grid gap-1">
					<div className="flex items-center gap-2">
						<span className="flex size-8 items-center justify-center rounded-lg bg-[#613f75] font-bold text-white">C</span>
						<span className="text-lg font-bold">{issuer?.companyName ?? "Cabinova"}</span>
					</div>
					{issuer?.address && <p className="text-zinc-600">{issuer.address}</p>}
					{issuer?.email && <p className="text-zinc-600">{issuer.email}</p>}
					{(issuer?.ice || issuer?.rc || issuer?.taxId) && (
						<p className="text-xs text-zinc-500">
							{[issuer.ice && `ICE ${issuer.ice}`, issuer.rc && `RC ${issuer.rc}`, issuer.taxId && `IF ${issuer.taxId}`]
								.filter(Boolean)
								.join(" · ")}
						</p>
					)}
				</header>

				<div className="mb-8 grid gap-6 sm:grid-cols-2">
					<div>
						<p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Facture</p>
						<p className="text-xl font-semibold tabular-nums">{invoice.number}</p>
						<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-zinc-600">
							<dt>Émise le</dt>
							<dd>{long(invoice.issuedAt)}</dd>
							<dt>Échéance</dt>
							<dd className="font-medium text-zinc-900">{long(invoice.dueAt)}</dd>
						</dl>
					</div>
					<div>
						<p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Facturé à</p>
						<p className="font-semibold">{t.legalName ?? t.name}</p>
						{t.legalName && <p className="text-zinc-600">{t.name}</p>}
						<p className="text-zinc-600">{t.responsibleName}</p>
						{(t.address || t.city) && <p className="text-zinc-600">{[t.address, t.city].filter(Boolean).join(", ")}</p>}
						<p className="text-zinc-600">{t.email}</p>
					</div>
				</div>

				<table className="mb-8 w-full">
					<thead>
						<tr className="border-b-2 border-zinc-900 text-start text-xs uppercase tracking-wide text-zinc-500">
							<th className="py-2 text-start font-medium">Description</th>
							<th className="py-2 text-end font-medium">Montant</th>
						</tr>
					</thead>
					<tbody>
						<tr className="border-b">
							<td className="py-3 pe-6">{invoice.description}</td>
							<td className="py-3 text-end tabular-nums">{formatPrice(invoice.amount)}</td>
						</tr>
					</tbody>
					<tfoot>
						<tr>
							<td className="pt-3 text-end font-semibold">Total à payer</td>
							<td className="pt-3 text-end text-lg font-semibold tabular-nums">{formatPrice(invoice.amount)}</td>
						</tr>
					</tfoot>
				</table>

				<section className="rounded-lg border bg-zinc-50 p-5">
					<p className="mb-3 font-semibold">Paiement par virement bancaire</p>
					{issuer ? (
						<dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
							<dt className="text-zinc-500">Titulaire</dt>
							<dd>{issuer.accountHolder}</dd>
							<dt className="text-zinc-500">Banque</dt>
							<dd>{issuer.bankName}</dd>
							<dt className="text-zinc-500">RIB</dt>
							<dd className="font-mono tracking-wide">{formatRib(issuer.rib)}</dd>
							{issuer.swift && (
								<>
									<dt className="text-zinc-500">SWIFT</dt>
									<dd className="font-mono">{issuer.swift}</dd>
								</>
							)}
							<dt className="text-zinc-500">Référence</dt>
							<dd className="font-semibold">{invoice.number}</dd>
						</dl>
					) : (
						<p className="text-zinc-600">Les coordonnées bancaires seront communiquées par le support Cabinova.</p>
					)}
					<p className="mt-3 text-xs text-zinc-500">
						Merci d’indiquer la référence <strong>{invoice.number}</strong> dans le libellé du virement.
					</p>
				</section>

				{invoice.payments.length > 0 && (
					<section className="mt-6">
						<p className="mb-2 font-semibold">Paiements reçus</p>
						<ul className="grid gap-1 text-zinc-600">
							{invoice.payments.map((p) => (
								<li key={p.id}>
									{long(p.receivedAt)} — {formatPrice(p.amount)} par virement
									{p.reference && ` (réf. ${p.reference})`}
								</li>
							))}
						</ul>
					</section>
				)}
			</article>
		</div>
	);
}
