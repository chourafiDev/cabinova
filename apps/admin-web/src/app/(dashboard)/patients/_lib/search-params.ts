import { createSearchParamsCache, parseAsStringEnum } from "nuqs/server";
import type { FilterVariant } from "@/lib/data-table-types";
import { getDataTableSearchParams } from "@/lib/parsers";

// Patient list URL state. Column ids must match patients-table.tsx.
export const patientFilterColumns = {
	lastName: "text", // the "Patient" column: name, phone, CIN or file number
	sex: "multiSelect",
	coverage: "multiSelect",
	createdAt: "dateRange",
} satisfies Record<string, FilterVariant>;

export const patientSortColumns = ["lastName", "fileNumber", "birthDate", "createdAt"] as const;

export const PATIENT_STATUSES = ["active", "archived"] as const;
export const statusParser = parseAsStringEnum([...PATIENT_STATUSES]).withDefault("active");

export const patientsSearchParamsCache = createSearchParamsCache({
	...getDataTableSearchParams({
		filterableColumns: patientFilterColumns,
		sortableColumns: patientSortColumns,
		defaultSorting: [{ id: "lastName", desc: false }],
		defaultPerPage: 20,
	}),
	status: statusParser,
});
