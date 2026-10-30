import Link from "next/link";
import { notFound } from "next/navigation";
import { HiBanknotes } from "react-icons/hi2";
import { LuBanknote, LuClock, LuLandmark, LuSettings, LuTriangleAlert } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BillingSettings, InvoicesPage, Quote } from "@/lib/billing";
import { can } from "@/lib/permissions";
import { formatPrice } from "@/lib/plans";
import { plural } from "@/lib/plural";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FormCard } from "../_components/shared/form-card";
import { KpiCard } from "../_components/shared/kpi-card";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { InvoicesTable } from "./_components/invoices-table";
import { QuotesTable } from "./_components/quotes-table";

export const metadata = { title: "Facturation" };

const TABS = [
	{ key: "open", label: "À encaisser" },
	{ key: "quotes", label: "Devis" },
	{ key: "overdue", label: "En retard" },
	{ key: "paid", label: "Payées" },
	{ key: "void", label: "Annulées" },
	{ key: "all", label: "Toutes" },
] as const;

/**
 * Module 3 — invoices paid by bank transfer. The daily task: open
 * "À encaisser", match each transfer on the bank statement to its invoice
 * and record it. Renewal invoices are issued automatically. Cabinets on
 * trial pay a devis first ("Devis"): the facture follows their payment.
 */
export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "billing:read")) notFound();
	const canWrite = can(session.user.permissions, "billing:write");
	const { status: rawStatus, search: rawSearch } = await searchParams;
	const status = TABS.some((t) => t.key === rawStatus) ? (rawStatus as string) : "open";
	const search = typeof rawSearch === "string" ? rawSearch.trim() : "";
	const quotesTab = status === "quotes";
	const query = new URLSearchParams({ ...(status !== "all" && !quotesTab && { status }), ...(search && { search }) });
	const [page, settings, quotes] = await Promise.all([
		apiGet<InvoicesPage>(`/billing/invoices?${query}`),
		apiGet<BillingSettings>("/billing/settings"),
		apiGet<{ data: Quote[] }>("/billing/quotes"),
	]);
	const pendingQuotes = quotes.data.filter((q) => q.status === "pending").length;
	const href = (s: string) => `/billing?${new URLSearchParams({ status: s, ...(search && { search }) })}`;

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiBanknotes />}
				total={quotesTab ? quotes.data.length : page.data.length}
				label={quotesTab ? { singular: "Devis", plural: "Devis" } : { singular: "Facture", plural: "Factures" }}
				action={
					<Button asChild variant="outline">
						<Link href="/billing/settings">
							<LuSettings /> Coordonnées bancaires
						</Link>
					</Button>
				}
			/>

			{!settings.configured && (
				<div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
					<LuLandmark className="size-4 shrink-0" />
					<span className="min-w-0 flex-1">
						Votre RIB n’est pas encore renseigné : les factures sont émises sans coordonnées bancaires.
					</span>
					{canWrite && (
						<Button asChild size="sm" variant="outline">
							<Link href="/billing/settings">Renseigner le RIB</Link>
						</Button>
					)}
				</div>
			)}

			<section className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
				<KpiCard
					icon={LuClock}
					title="À encaisser"
					value={formatPrice(page.totals.open)}
					period="Factures émises, pas encore échues"
					hint="Montant des factures en attente de virement, dans le délai de paiement."
				/>
				<KpiCard
					icon={LuTriangleAlert}
					title="En retard"
					value={formatPrice(page.totals.overdue)}
					valueClassName={page.totals.overdue ? "text-destructive" : undefined}
					period={plural(page.totals.overdueCount, "facture échue", "factures échues")}
					hint="Factures dont la date d’échéance est passée sans virement reçu. Un rappel est envoyé automatiquement."
				/>
				<KpiCard
					icon={LuBanknote}
					title="Encaissé"
					value={formatPrice(page.totals.collectedThisMonth)}
					period="Ce mois-ci"
					hint="Virements enregistrés ce mois-ci."
				/>
			</section>

			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<nav className="flex gap-1 rounded-lg bg-muted p-[3px] text-sm" aria-label="Filtrer par statut">
					{TABS.map((t) => (
						<Link
							key={t.key}
							href={href(t.key)}
							aria-current={t.key === status ? "page" : undefined}
							className={cn("rounded-md px-3 py-1 text-muted-foreground", t.key === status && "bg-background text-foreground shadow-sm")}
						>
							{t.label}
							{t.key === "quotes" && pendingQuotes > 0 && (
								<span className="ms-1.5 rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground tabular-nums">
									{pendingQuotes}
								</span>
							)}
						</Link>
					))}
				</nav>
				{!quotesTab && (
					<form action="/billing" className="w-full sm:w-64">
						<input type="hidden" name="status" value={status} />
						<Input name="search" defaultValue={search} placeholder="N° de facture ou cabinet…" aria-label="Rechercher" />
					</form>
				)}
			</div>

			<FormCard contentClassName="p-0">
				{quotesTab ? (
					<QuotesTable quotes={quotes.data} canWrite={canWrite} />
				) : (
					<InvoicesTable invoices={page.data} canWrite={canWrite} />
				)}
			</FormCard>
		</ListTransitionProvider>
	);
}
