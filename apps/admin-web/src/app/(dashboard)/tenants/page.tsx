import { notFound } from "next/navigation";
import { HiBuildingOffice2 } from "react-icons/hi2";
import { getDataTableQuery } from "@/lib/parsers";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import type { PlanRow } from "@/lib/plans";
import type { TenantsPage } from "@/lib/tenants";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { TenantsTable } from "./_components/tenants-table";
import { tenantFilterColumns, tenantsSearchParamsCache } from "./_lib/search-params";

export const metadata = { title: "Cabinets" };

export default async function TenantsPage({ searchParams }: PageProps<"/tenants">) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "tenants:read")) notFound();

	const search = tenantsSearchParamsCache.parse(await searchParams);
	const { page, perPage, sorting, filters } = getDataTableQuery(search, tenantFilterColumns);
	const text = filters.find((f) => f.id === "name")?.value;
	const status = filters.find((f) => f.id === "status")?.value;
	const plan = filters.find((f) => f.id === "plan")?.value;
	const sort = sorting[0];
	const query = new URLSearchParams({
		page: String(page),
		perPage: String(perPage),
		...(typeof text === "string" && text.trim() && { search: text.trim() }),
		...(Array.isArray(status) && status.length && { status: status.join(",") }),
		...(Array.isArray(plan) && plan.length && { plan: plan.join(",") }),
		...(sort && { sort: `${sort.id}.${sort.desc ? "desc" : "asc"}` }),
	});
	const [{ data, total, pageCount }, plans] = await Promise.all([
		apiGet<TenantsPage>(`/tenants?${query}`),
		can(session.user.permissions, "subscriptions:read") ? apiGet<PlanRow[]>("/plans") : [],
	]);

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiBuildingOffice2 />}
				total={total}
				label={{ singular: "Cabinet", plural: "Cabinets" }}
				create={
					can(session.user.permissions, "tenants:write")
						? { href: "/tenants/new", label: "Ajouter un cabinet" }
						: undefined
				}
			/>
			<TenantsTable
				data={data}
				pageCount={pageCount}
				planOptions={plans.map((p) => ({ value: p.key, label: p.name }))}
			/>
		</ListTransitionProvider>
	);
}
