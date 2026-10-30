import type { ReactNode } from "react";
import { formatRib, type QuoteDocument } from "@/lib/billing";
import { formatMad } from "@/lib/format";
import { PrintButton } from "../receipts/[id]/print-button";

type Party = Pick<QuoteDocument, "cabinet" | "issuer">;

/** Devis and factures from Cabinova to the cabinet: same paper, same parties. */
export function BillingDocument({
	kind,
	number,
	dates,
	stamp,
	party,
	children,
}: {
	kind: "Devis" | "Facture";
	number: string;
	dates: [string, string][];
	stamp?: { label: string; className: string };
	party: Party;
	children: ReactNode;
}) {
	const { cabinet: c, issuer } = party;
	return (
		<div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
			<div className="mb-4 flex justify-end print:hidden">
				<PrintButton />
			</div>
			<article className="paper relative overflow-hidden rounded-xl border bg-white p-10 text-sm text-zinc-900 shadow-sm print:rounded-none print:border-0 print:shadow-none">
				{stamp && (
					<span
						className={`absolute end-10 top-10 rotate-6 rounded-md border-2 px-3 py-1 text-base font-bold uppercase tracking-wider ${stamp.className}`}
					>
						{stamp.label}
					</span>
				)}
				<header className="mb-10 grid gap-1">
					<p className="text-lg font-bold">{issuer?.companyName ?? "Cabinova"}</p>
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
						<p className="mb-1 text-xs tracking-wide text-zinc-500 uppercase">{kind}</p>
						<p className="text-xl font-semibold tabular-nums">{number}</p>
						<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-zinc-600">
							{dates.flatMap(([label, value]) => [<dt key={label}>{label}</dt>, <dd key={`${label}-v`}>{value}</dd>])}
						</dl>
					</div>
					<div>
						<p className="mb-1 text-xs tracking-wide text-zinc-500 uppercase">{kind === "Devis" ? "Pour" : "Facturé à"}</p>
						<p className="font-semibold">{c.legalName ?? c.name}</p>
						{c.legalName && <p className="text-zinc-600">{c.name}</p>}
						<p className="text-zinc-600">{c.responsibleName}</p>
						{(c.address || c.city) && <p className="text-zinc-600">{[c.address, c.city].filter(Boolean).join(", ")}</p>}
						<p className="text-zinc-600">{c.email}</p>
					</div>
				</div>
				{children}
			</article>
		</div>
	);
}

export function AmountTable({
	description,
	amount,
	credit = 0,
	totalLabel,
}: {
	description: string;
	amount: number;
	credit?: number;
	totalLabel: string;
}) {
	return (
		<table className="mb-8 w-full">
			<thead>
				<tr className="border-b-2 border-zinc-900 text-xs tracking-wide text-zinc-500 uppercase">
					<th className="py-2 text-start font-medium">Description</th>
					<th className="py-2 text-end font-medium">Montant</th>
				</tr>
			</thead>
			<tbody>
				<tr className="border-b">
					<td className="py-3 pe-6">{description}</td>
					<td className="py-3 text-end tabular-nums">{formatMad(amount + credit)}</td>
				</tr>
				{credit > 0 && (
					<tr className="border-b">
						<td className="py-3 pe-6 text-zinc-600">Avoir déduit</td>
						<td className="py-3 text-end text-zinc-600 tabular-nums">−{formatMad(credit)}</td>
					</tr>
				)}
			</tbody>
			<tfoot>
				<tr>
					<td className="pt-3 pe-6 text-end font-semibold">{totalLabel}</td>
					<td className="pt-3 text-end text-lg font-semibold tabular-nums">{formatMad(amount)}</td>
				</tr>
			</tfoot>
		</table>
	);
}

export function TransferDetails({ issuer, reference }: { issuer: Party["issuer"]; reference: string }) {
	return (
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
					<dd className="font-semibold">{reference}</dd>
				</dl>
			) : (
				<p className="text-zinc-600">Les coordonnées bancaires vous seront communiquées par le support Cabinova.</p>
			)}
			<p className="mt-3 text-xs text-zinc-500">
				Merci d’indiquer la référence <strong>{reference}</strong> dans le libellé du virement.
			</p>
		</section>
	);
}
