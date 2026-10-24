import type { Metadata } from "next";
import { HiOutlineClock, HiOutlineExclamationTriangle } from "react-icons/hi2";
import {
	LuBanknote,
	LuBuilding2,
	LuCircleCheck,
	LuFileText,
	LuHourglass,
	LuReceipt,
	LuTrendingUp,
	LuUserPlus,
} from "react-icons/lu";
import { type DashboardOverview, dashboardQuery } from "@/lib/dashboard";
import { can } from "@/lib/permissions";
import { formatPrice } from "@/lib/plans";
import { plural } from "@/lib/plural";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { AlertsCard } from "./_components/dashboard/alerts-card";
import { BreakdownCard } from "./_components/dashboard/breakdown-card";
import { DashboardFilters } from "./_components/dashboard/dashboard-filters";
import { PlansDonut } from "./_components/dashboard/plans-donut";
import { SubscriptionsChart } from "./_components/dashboard/subscriptions-chart";
import Header from "./_components/header";
import { KpiCard } from "./_components/shared/kpi-card";

export const metadata: Metadata = { title: "Tableau de bord" };

/**
 * Module 1 — consolidated platform figures, never patient data. Filters
 * select a set of cabinets (creation period, status, plan, city,
 * specialty); alerts stay platform-wide. Billed, collected and unpaid
 * amounts are separate KPIs, as the spec requires.
 */
export default async function DashboardPage({ searchParams }: PageProps<"/">) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "dashboard:read")) {
		return <Header />;
	}
	const params = await searchParams;
	const query = dashboardQuery(params);
	const data = await apiGet<DashboardOverview>(`/dashboard?${query}`);
	const { tenants, subscriptions, billing } = data.kpis;
	const s = tenants.byStatus;
	const pending = (s.pending ?? 0) + (s.provisioning ?? 0);
	const blocked = (s.suspended ?? 0) + (s.closure_pending ?? 0);

	// A breakdown row → this dashboard filtered on it (other filters kept).
	const filtered = (key: string, value: string) => {
		const next = new URLSearchParams(
			Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"),
		);
		next.set(key, value);
		return `/?${next}`;
	};

	return (
		<>
			<Header />
			<DashboardFilters options={data.filters} exportHref={`/api/dashboard/export.csv?${query}`}>
				<section className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<KpiCard
						icon={LuBuilding2}
						title="Cabinets"
						value={tenants.total}
						period="Sélection"
						hint="Cabinets correspondant aux filtres, tous statuts confondus."
						actions={[{ label: "Voir les cabinets", href: "/tenants" }]}
					/>
					<KpiCard
						icon={LuCircleCheck}
						title="Actifs"
						value={s.active ?? 0}
						period="Maintenant"
						hint="Cabinets avec un accès actif."
						actions={[{ label: "Voir les cabinets actifs", href: "/tenants?status=active" }]}
					/>
					<KpiCard
						icon={HiOutlineClock}
						title="En attente"
						value={pending}
						period="Maintenant"
						hint="Créés mais pas encore provisionnés (ou en cours de provisionnement)."
						actions={[{ label: "Voir", href: "/tenants?status=pending,provisioning" }]}
					/>
					<KpiCard
						icon={HiOutlineExclamationTriangle}
						title="Suspendus / en fermeture"
						value={blocked}
						valueClassName={blocked ? "text-destructive" : undefined}
						period={s.closed ? `${plural(s.closed, "fermé")} au total` : "Maintenant"}
						hint="Suspendus (impayé, sécurité, demande…) ou en période de fermeture."
						actions={[{ label: "Voir", href: "/tenants?status=suspended,closure_pending" }]}
					/>
				</section>

				<section className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<KpiCard
						icon={LuUserPlus}
						title="Nouveaux cabinets"
						value={tenants.newLast30Days}
						change={tenants.newChange}
						period="30 derniers jours"
						hint="Cabinets créés ces 30 derniers jours, comparés aux 30 jours précédents."
					/>
					<KpiCard
						icon={LuHourglass}
						title="En essai"
						value={subscriptions.trialing}
						period={`${subscriptions.trialsEndingIn7Days} fin(s) d’essai sous 7 j`}
						hint="Abonnements en période d’essai gratuite."
					/>
					<KpiCard
						icon={LuTrendingUp}
						title="Revenu mensuel contractuel"
						value={formatPrice(subscriptions.mrr)}
						period={`${subscriptions.active + subscriptions.pastDue} abonnement(s) payant(s)`}
						hint="Somme mensuelle des abonnements payants (annuel ÷ 12). Montant prévu par contrat, pas un encaissement."
					/>
					<KpiCard
						icon={LuHourglass}
						title="Potentiel des essais"
						value={formatPrice(subscriptions.trialMrr)}
						period="Par mois, si convertis"
						hint="Revenu mensuel que les cabinets en essai apporteraient en passant à l’offre payante."
					/>
				</section>

				<section className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
					<KpiCard
						icon={LuFileText}
						title="Facturé"
						value={formatPrice(billing.billedThisMonth)}
						period="Ce mois-ci"
						hint="Montant des factures émises ce mois-ci, payées ou non."
					/>
					<KpiCard
						icon={LuBanknote}
						title="Encaissé"
						value={formatPrice(billing.collectedThisMonth)}
						period="Ce mois-ci"
						hint="Paiements réellement reçus ce mois-ci."
					/>
					<KpiCard
						icon={LuReceipt}
						title="Impayés"
						value={formatPrice(billing.unpaid)}
						valueClassName={billing.unpaid ? "text-destructive" : undefined}
						period={plural(billing.unpaidCount, "facture en retard", "factures en retard")}
						hint="Factures échues et non payées, tous mois confondus."
					/>
				</section>
				{billing.invoiceCount === 0 && billing.unpaid === 0 && (
					<p className="-mt-1 mb-3 text-xs text-muted-foreground">
						Aucune facture pour l’instant : facturé, encaissé et impayés se rempliront quand le prestataire de
						paiement sera branché.
					</p>
				)}

				<div className="mb-3 grid gap-3 lg:grid-cols-[2fr_1fr]">
					<SubscriptionsChart series={data.series} />
					<PlansDonut
						rows={data.breakdowns.plan}
						planOrder={data.filters.plans.map((p) => p.key)}
						hrefs={Object.fromEntries(
							data.breakdowns.plan.map((r) => [r.key ?? "none", filtered("plan", r.key ?? "none")]),
						)}
					/>
				</div>

				<div className="grid gap-3 lg:grid-cols-3">
					<BreakdownCard
						title="Cabinets par ville"
						rows={data.breakdowns.city}
						hrefs={Object.fromEntries(data.filters.cities.map((c) => [c, filtered("city", c)]))}
					/>
					<BreakdownCard
						title="Cabinets par spécialité"
						rows={data.breakdowns.specialty}
						hrefs={Object.fromEntries(data.filters.specialties.map((c) => [c, filtered("specialty", c)]))}
					/>
					<AlertsCard alerts={data.alerts} />
				</div>
			</DashboardFilters>
		</>
	);
}
