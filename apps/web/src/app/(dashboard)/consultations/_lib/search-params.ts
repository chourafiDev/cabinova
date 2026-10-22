import { createSearchParamsCache } from "nuqs/server";
import type { FilterVariant } from "@/lib/data-table-types";
import { getDataTableSearchParams } from "@/lib/parsers";

// Consultation list URL state. Column ids must match consultations-table.tsx.
export const consultationFilterColumns = {
	patient: "text", // patient name or file number
	status: "multiSelect",
} satisfies Record<string, FilterVariant>;

export const consultationSortColumns = ["startedAt"] as const;

export const consultationsSearchParamsCache = createSearchParamsCache(
	getDataTableSearchParams({
		filterableColumns: consultationFilterColumns,
		sortableColumns: consultationSortColumns,
		defaultSorting: [{ id: "startedAt", desc: true }],
		defaultPerPage: 20,
	}),
);
