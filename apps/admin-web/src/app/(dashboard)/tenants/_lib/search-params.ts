import { createSearchParamsCache } from "nuqs/server";
import type { FilterVariant } from "@/lib/data-table-types";
import { getDataTableSearchParams } from "@/lib/parsers";

// Cabinets list URL state. Column ids must match tenants-table.tsx.
export const tenantFilterColumns = {
	name: "text", // name, responsible doctor or e-mail
	status: "multiSelect",
	plan: "multiSelect",
} satisfies Record<string, FilterVariant>;

export const tenantSortColumns = ["name", "createdAt"] as const;

export const tenantsSearchParamsCache = createSearchParamsCache(
	getDataTableSearchParams({
		filterableColumns: tenantFilterColumns,
		sortableColumns: tenantSortColumns,
		defaultSorting: [{ id: "createdAt", desc: true }],
		defaultPerPage: 20,
	}),
);
