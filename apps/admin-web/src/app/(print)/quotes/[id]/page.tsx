import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { formatRib, QUOTE_STATUS_LABELS, type QuoteDetail } from "@/lib/billing";
import { getBranding } from "@/lib/branding";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { formatPrice } from "@/lib/plans";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { PrintButton } from "../../invoices/[id]/print-button";

export async function generateMetadata({ params }: PageProps<"/quotes/[id]">) {
	const quote = await apiGet<QuoteDetail>(`/billing/quotes/${(await params).id}`);
	return { title: `Devis ${quote.number}` };
}

/** The devis as a document (print / save as PDF), as the cabinet sees it. */
export default async function QuotePrintPage({ params }: PageProps<"/quotes/[id]">) {
	const { id } = await params;
	const session = await getSession();
	if (!session || !can(session.user.permissions, "billing:read")) notFound();
	const [quote, branding] = await Promise.all([apiGet<QuoteDetail>(`/billing/quotes/${id}`), getBranding()]);
	const issuer = quote.issuer.configured ? quote.issuer : null;
	const t = quote.tenant;

	return (
		<div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
			<div className="mb-4 flex justify-end print:hidden">
				<PrintButton />
			</div>
			<article className="paper relative overflow-hidden rounded-xl border bg-white p-10 text-sm text-zinc-900 shadow-sm print:rounded-none print:border-0 print:shadow-none">
				{quote.status !== "pending" && (
					<span className="absolute end-10 top-10 rotate-6 rounded-md border-2 border-zinc-400 px-3 py-1 text-base font-bold uppercase tracking-wider text-zinc-500">
						{QUOTE_STATUS_LABELS[quote.status]}
					</span>
				)}
				<header className="mb-10 grid gap-1">
					<div className="flex items-center gap-2">
						<BrandMark branding={branding} className="font-bold" />
						<span className="text-lg font-bold">{issuer?.companyName ?? branding.platformName}</span>
					</div>
					{issuer?.address && <p className="text-zinc-600">{issuer.address}</p>}
					{issuer?.email && <p className="text-zinc-600">{issuer.email}</p>}
				</header>

				<div className="mb-8 grid gap-6 sm:grid-cols-2">
					<div>
						<p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Devis</p>
						<p className="text-xl font-semibold tabular-nums">{quote.number}</p>
						<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-zinc-600">
							<dt>Émis le</dt>
							<dd>{formatDate(quote.issuedAt)}</dd>
							<dt>À régler avant</dt>
							<dd className="font-medium text-zinc-900">{formatDate(quote.dueAt)}</dd>
						</dl>
					</div>
					<div>
						<p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Pour</p>
						<p className="font-semibold">{t.legalName ?? t.name}</p>
						{t.legalName && <p className="text-zinc-600">{t.name}</p>}
						<p className="text-zinc-600">{t.responsibleName}</p>
						{(t.address || t.city) && <p className="text-zinc-600">{[t.address, t.city].filter(Boolean).join(", ")}</p>}
						<p className="text-zinc-600">{t.email}</p>
					</div>
				</div>

				<table className="mb-8 w-full">
					<thead>
						<tr className="border-b-2 border-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
							<th className="py-2 text-start font-medium">Description</th>
							<th className="py-2 text-end font-medium">Montant</th>
						</tr>
					</thead>
					<tbody>
						<tr className="border-b">
							<td className="py-3 pe-6">{quote.description}</td>
							<td className="py-3 text-end tabular-nums">{formatPrice(quote.amount)}</td>
						</tr>
					</tbody>
					<tfoot>
						<tr>
							<td className="pt-3 text-end font-semibold">Total à payer</td>
							<td className="pt-3 text-end text-lg font-semibold tabular-nums">{formatPrice(quote.amount)}</td>
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
							<dt className="text-zinc-500">Référence</dt>
							<dd className="font-semibold">{quote.number}</dd>
						</dl>
					) : (
						<p className="text-zinc-600">Les coordonnées bancaires seront communiquées par le support {branding.platformName}.</p>
					)}
				</section>
				<p className="mt-4 text-xs text-zinc-500">Ce devis n’est pas une facture. La facture est émise à réception du paiement.</p>
			</article>
		</div>
	);
}
