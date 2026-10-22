import { createSearchParamsCache } from "nuqs/server";
import type { FilterVariant } from "@/lib/data-table-types";
import { getDataTableSearchParams } from "@/lib/parsers";

// Journal d'activité URL state. Column ids must match activity-log-table.tsx.
export const activityFilterColumns = {
	member: "text", // acting member's name or e-mail
	entity: "multiSelect",
	createdAt: "dateRange",
} satisfies Record<string, FilterVariant>;

export const activitySearchParamsCache = createSearchParamsCache(
	getDataTableSearchParams({
		filterableColumns: activityFilterColumns,
		sortableColumns: [],
		defaultPerPage: 20,
	}),
);
