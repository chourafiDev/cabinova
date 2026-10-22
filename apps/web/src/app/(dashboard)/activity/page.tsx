import { notFound } from "next/navigation";
import { HiClock } from "react-icons/hi2";
import type { AuditLogsPage } from "@/lib/audit";
import { getDataTableQuery } from "@/lib/parsers";
import { can } from "@/lib/permissions";
import { apiGet } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { ListHeader } from "../_components/shared/list-header";
import { ListTransitionProvider } from "../_components/shared/list-transition";
import { ActivityLogTable } from "./_components/activity-log-table";
import { activityFilterColumns, activitySearchParamsCache } from "./_lib/search-params";

export const metadata = { title: "Journal d'activité" };

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
	const session = await getSession();
	if (!session || !can(session.user.permissions, "settings:read")) notFound();

	const search = activitySearchParamsCache.parse(await searchParams);
	const { page, perPage, filters } = getDataTableQuery(search, activityFilterColumns);
	const text = filters.find((f) => f.id === "member")?.value;
	const entity = filters.find((f) => f.id === "entity")?.value;
	const createdAt = filters.find((f) => f.id === "createdAt")?.value;
	// Picked days, as ms timestamps; the API adds the end-of-day bound.
	const [fromMs, toMs] = Array.isArray(createdAt) ? createdAt : [];
	const query = new URLSearchParams({
		page: String(page),
		perPage: String(perPage),
		...(typeof text === "string" && text.trim() && { search: text.trim() }),
		...(Array.isArray(entity) && entity.length && { entity: entity.join(",") }),
		...(fromMs && { from: new Date(Number(fromMs)).toISOString() }),
		...(toMs && { to: new Date(Number(toMs)).toISOString() }),
	});
	const { data, total, pageCount } = await apiGet<AuditLogsPage>(`/audit-logs?${query}`);

	return (
		<ListTransitionProvider>
			<ListHeader
				icon={<HiClock />}
				total={total}
				label={{ singular: "Action enregistrée", plural: "Actions enregistrées" }}
			/>
			<ActivityLogTable data={data} pageCount={pageCount} />
		</ListTransitionProvider>
	);
}
