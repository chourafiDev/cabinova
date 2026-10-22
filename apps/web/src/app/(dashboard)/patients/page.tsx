import { notFound } from "next/navigation";
import { HiUsers } from "react-icons/hi2";
import { getDataTableQuery } from "@/lib/parsers";
import { can } from "@/lib/permissions";
import type { PatientsPage } from "@/lib/patients";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { PatientsTable } from "./_components/patients-table";
import { StatusTabs } from "./_components/status-tabs";
import { patientFilterColumns, patientsSearchParamsCache } from "./_lib/search-params";

export const metadata = { title: "Patients" };

export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "patients:read")) notFound();

	const search = patientsSearchParamsCache.parse(await searchParams);
	const { page, perPage, sorting, filters } = getDataTableQuery(search, patientFilterColumns);
	const text = filters.find((f) => f.id === "lastName")?.value;
	const sex = filters.find((f) => f.id === "sex")?.value;
	const coverage = filters.find((f) => f.id === "coverage")?.value;
	const createdAt = filters.find((f) => f.id === "createdAt")?.value;
	// Picked days, as ms timestamps; the API adds the end-of-day bound.
	const [createdFromMs, createdToMs] = Array.isArray(createdAt) ? createdAt : [];
	const sort = sorting[0];
	const query = new URLSearchParams({
		page: String(page),
		perPage: String(perPage),
		status: search.status,
		...(typeof text === "string" && text.trim() && { search: text.trim() }),
		...(Array.isArray(sex) && sex.length && { sex: sex.join(",") }),
		...(Array.isArray(coverage) && coverage.length && { coverage: coverage.join(",") }),
		...(createdFromMs && { createdFrom: new Date(Number(createdFromMs)).toISOString() }),
		...(createdToMs && { createdTo: new Date(Number(createdToMs)).toISOString() }),
		...(sort && { sort: `${sort.id}.${sort.desc ? "desc" : "asc"}` }),
	});
	const { data, total, pageCount } = await apiGet<PatientsPage>(`/patients?${query}`);

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiUsers />}
				total={total}
				label={{ singular: "Patient", plural: "Patients" }}
				create={
					can(session.user.permissions, "patients:write")
						? { href: "/patients/new", label: "Nouveau patient" }
						: undefined
				}
			/>
			<StatusTabs />
			<PatientsTable
				data={data}
				pageCount={pageCount}
				canDelete={can(session.user.permissions, "patients:delete")}
			/>
		</ListTransitionProvider>
	);
}
