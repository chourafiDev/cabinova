import type { Metadata } from "next";
import { HiOutlineClock, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { LuBuilding2, LuCircleCheck } from "react-icons/lu";
import { can } from "@/lib/permissions";
import { serverApi } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import type { TenantsPage } from "@/lib/tenants";
import Header from "./_components/header";
import { KpiCard } from "./_components/shared/kpi-card";

export const metadata: Metadata = { title: "Tableau de bord" };

/** total for a /tenants filter, without paging through the rows. */
async function countTenants(query: string) {
	const res = await serverApi(`/tenants?perPage=1&${query}`);
	if (!res.ok) return null;
	const page: TenantsPage = await res.json();
	return page.total;
}

// Module 1 — only KPIs backed by real data ship now: counts from the
// tenants table. Revenue/billed-vs-collected/churn need Module 3, alerts
// (backup failures, unreachable tenant DBs) need Module 4.
export default async function DashboardPage() {
	const session = await getSession();
	const canRead = can(session?.user.permissions, "tenants:read");

	const [total, active, pending, suspended] = canRead
		? await Promise.all([
				countTenants(""),
				countTenants("status=active"),
				countTenants("status=pending,provisioning"),
				countTenants("status=suspended"),
			])
		: [null, null, null, null];

	return (
		<>
			<Header />
			{canRead && (
				<section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<KpiCard
						icon={LuBuilding2}
						title="Cabinets"
						value={total ?? 0}
						period="Total"
						hint="Nombre total de cabinets créés sur la plateforme."
						actions={[{ label: "Voir les cabinets", href: "/tenants" }]}
					/>
					<KpiCard
						icon={LuCircleCheck}
						title="Actifs"
						value={active ?? 0}
						period="Maintenant"
						hint="Cabinets avec un accès actif."
						actions={[{ label: "Voir les cabinets actifs", href: "/tenants?status=active" }]}
					/>
					<KpiCard
						icon={HiOutlineClock}
						title="En attente"
						value={pending ?? 0}
						period="Maintenant"
						hint="Cabinets créés mais pas encore provisionnés."
						actions={[{ label: "Voir", href: "/tenants?status=pending" }]}
					/>
					<KpiCard
						icon={HiOutlineExclamationTriangle}
						title="Suspendus"
						value={suspended ?? 0}
						valueClassName={suspended ? "text-destructive" : undefined}
						period="Maintenant"
						hint="Impayé, demande du responsable, fraude, sécurité…"
						actions={[{ label: "Voir les cabinets suspendus", href: "/tenants?status=suspended" }]}
					/>
				</section>
			)}
		</>
	);
}
