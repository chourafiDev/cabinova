import { notFound } from "next/navigation";
import { HiClipboardDocumentList } from "react-icons/hi2";
import type { ConsultationsPage } from "@/lib/consultations";
import { getDataTableQuery } from "@/lib/parsers";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { ConsultationsTable } from "./_components/consultations-table";
import { consultationFilterColumns, consultationsSearchParamsCache } from "./_lib/search-params";

export const metadata = { title: "Consultations" };

export default async function ConsultationsListPage({ searchParams }: PageProps<"/consultations">) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "emr:read")) notFound();

	const search = consultationsSearchParamsCache.parse(await searchParams);
	const { page, perPage, sorting, filters } = getDataTableQuery(search, consultationFilterColumns);
	const text = filters.find((f) => f.id === "patient")?.value;
	const status = filters.find((f) => f.id === "status")?.value;
	const sort = sorting[0];
	const query = new URLSearchParams({
		page: String(page),
		perPage: String(perPage),
		...(typeof text === "string" && text.trim() && { search: text.trim() }),
		...(Array.isArray(status) && status.length && { status: status.join(",") }),
		...(sort && { sort: `${sort.id}.${sort.desc ? "desc" : "asc"}` }),
	});
	const { data, total, pageCount } = await apiGet<ConsultationsPage>(`/consultations?${query}`);

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiClipboardDocumentList />}
				total={total}
				label={{ singular: "Consultation", plural: "Consultations" }}
			/>
			<ConsultationsTable data={data} pageCount={pageCount} />
		</ListTransitionProvider>
	);
}
