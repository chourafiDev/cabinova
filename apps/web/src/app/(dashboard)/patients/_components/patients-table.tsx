"use client";

import type { ColumnDef, HeaderContext } from "@tanstack/react-table";
import { CalendarIcon, Download, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { getDataTableSelectColumn } from "@/components/data-table/data-table-select-column";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { formatDate } from "@/lib/format";
import {
	ageOf,
	COVERAGE_LABELS,
	formatFileNumber,
	formatPhone,
	fullName,
	type PatientRow,
	SEX_LABELS,
} from "@/lib/patients";
import { api } from "@/lib/api-client";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import {
	BULK_BAR_TABLE_CLASS,
	type BulkAction,
	BulkActionsHeader,
} from "../../_components/shared/bulk-actions-header";
import { useListTransition } from "../../_components/shared/list-transition";

const SEX_OPTIONS = Object.entries(SEX_LABELS).map(([value, label]) => ({ value, label }));
const COVERAGE_OPTIONS = Object.entries(COVERAGE_LABELS).map(([value, label]) => ({ value, label }));

/** Downloads the CSV built by the API (every administrative field of the selected files). */
async function exportCsv(ids: string[]) {
	const res = await fetch("/api/patients/export", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ids }),
	});
	if (!res.ok) throw new Error("Export impossible");
	const filename = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "patients.csv";
	const url = URL.createObjectURL(await res.blob());
	const link = Object.assign(document.createElement("a"), { href: url, download: filename });
	link.click();
	URL.revokeObjectURL(url);
	return `${plural(ids.length, "patient")} exporté${ids.length > 1 ? "s" : ""}`;
}

const EXPORT_ACTION: BulkAction = {
	id: "export",
	label: "Exporter CSV",
	icon: Download,
	keepSelection: true,
	run: exportCsv,
};

const DELETE_ACTION: BulkAction = {
	id: "delete",
	label: "Supprimer",
	icon: Trash2,
	destructive: true,
	confirm: {
		title: (count) => `Supprimer ${plural(count, "dossier")} ?`,
		description:
			"Seuls les dossiers sans rendez-vous ni consultation sont supprimés définitivement (créés par erreur, doublons). Les dossiers avec un historique médical sont conservés : archivez-les.",
	},
	run: async (ids) => {
		const { deleted, kept } = await api<{ deleted: number; kept: number }>("/patients/bulk-delete", {
			method: "POST",
			body: JSON.stringify({ ids }),
		});
		if (!deleted) throw new Error("Aucun dossier supprimé : ils ont tous un historique (archivez-les).");
		return kept
			? `${plural(deleted, "dossier")} supprimé${deleted > 1 ? "s" : ""}, ${kept} conservé${kept > 1 ? "s" : ""} (historique)`
			: `${plural(deleted, "dossier")} supprimé${deleted > 1 ? "s" : ""}`;
	},
};

export function PatientsTable({
	data,
	pageCount,
	canDelete,
}: {
	data: PatientRow[];
	pageCount: number;
	/** patients:delete */
	canDelete: boolean;
}) {
	const { isPending, startTransition } = useListTransition();
	const actions = useMemo(() => (canDelete ? [EXPORT_ACTION, DELETE_ACTION] : [EXPORT_ACTION]), [canDelete]);

	const columns = useMemo<ColumnDef<DataTableFeatures, PatientRow>[]>(
		() => [
			Object.assign(getDataTableSelectColumn<PatientRow>(), {
				header: ({ table }: HeaderContext<DataTableFeatures, PatientRow>) => (
					<BulkActionsHeader table={table} actions={actions} />
				),
			}),
			{
				// Sorts by name; its text filter searches name, phone, CIN and file number.
				id: "lastName",
				accessorFn: (row) => fullName(row),
				header: ({ column }) => <DataTableColumnHeader column={column} label="Patient" />,
				cell: ({ row }) => (
					<Link href={`/patients/${row.original.id}`} className="group/name grid leading-tight">
						<span className="font-medium group-hover/name:underline">{fullName(row.original)}</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{formatFileNumber(row.original.fileNumber)}
						</span>
					</Link>
				),
				meta: { label: "Patient", placeholder: "Nom, téléphone, CIN, n° de dossier…", variant: "text", icon: Search },
				enableColumnFilter: true,
				enableHiding: false,
			},
			{
				id: "fileNumber",
				accessorKey: "fileNumber",
				header: ({ column }) => <DataTableColumnHeader column={column} label="N° dossier" />,
				cell: ({ row }) => <span className="tabular-nums">{formatFileNumber(row.original.fileNumber)}</span>,
				meta: { label: "N° dossier" },
			},
			{
				id: "sex",
				accessorKey: "sex",
				header: "Sexe",
				cell: ({ row }) => SEX_LABELS[row.original.sex],
				meta: { label: "Sexe", variant: "multiSelect", options: SEX_OPTIONS, icon: Users },
				enableColumnFilter: true,
				enableSorting: false,
			},
			{
				id: "birthDate",
				accessorKey: "birthDate",
				header: ({ column }) => <DataTableColumnHeader column={column} label="Âge" />,
				cell: ({ row }) => {
					const age = ageOf(row.original.birthDate);
					return age === null ? (
						<span className="text-muted-foreground">—</span>
					) : (
						<div className="grid leading-tight">
							<span>{age} ans</span>
							<span className="text-muted-foreground text-xs">
								{formatDate(row.original.birthDate!, { month: "2-digit" })}
							</span>
						</div>
					);
				},
				meta: { label: "Âge" },
			},
			{
				id: "phone",
				header: "Téléphone",
				cell: ({ row }) => (
					<span className="whitespace-nowrap tabular-nums">{formatPhone(row.original.phone) || "—"}</span>
				),
				meta: { label: "Téléphone" },
				enableSorting: false,
			},
			{
				id: "cin",
				header: "CIN",
				cell: ({ row }) => row.original.cin ?? <span className="text-muted-foreground">—</span>,
				meta: { label: "CIN" },
				enableSorting: false,
			},
			{
				id: "coverage",
				accessorKey: "coverage",
				header: "Couverture",
				cell: ({ row }) => (
					<span className={cn(row.original.coverage === "none" && "text-muted-foreground")}>
						{COVERAGE_LABELS[row.original.coverage]}
					</span>
				),
				meta: { label: "Couverture", variant: "multiSelect", options: COVERAGE_OPTIONS, icon: ShieldCheck },
				enableColumnFilter: true,
				enableSorting: false,
			},
			{
				id: "city",
				header: "Ville",
				cell: ({ row }) => row.original.city ?? <span className="text-muted-foreground">—</span>,
				meta: { label: "Ville" },
				enableSorting: false,
			},
			{
				id: "createdAt",
				accessorKey: "createdAt",
				header: ({ column }) => <DataTableColumnHeader column={column} label="Créé le" />,
				cell: ({ row }) => (
					<span className="text-muted-foreground whitespace-nowrap">
						{formatDate(row.original.createdAt, { month: "short" })}
					</span>
				),
				meta: { label: "Créé le", variant: "dateRange", icon: CalendarIcon },
				enableColumnFilter: true,
			},
		],
		[actions],
	);

	const { table } = useDataTable({
		data,
		columns,
		pageCount,
		getRowId: (row) => row.id,
		initialState: {
			sorting: [{ id: "lastName", desc: false }],
			pagination: { pageIndex: 0, pageSize: 20 },
			columnVisibility: { fileNumber: false, city: false },
		},
		shallow: false, // re-run the server query when the URL changes
		startTransition,
	});

	// New page/filter/sort → new rows: drop a selection the user can no longer see.
	useEffect(() => {
		table.resetRowSelection();
	}, [data, table]);

	return (
		<DataTable table={table} className={cn(BULK_BAR_TABLE_CLASS, isPending && "opacity-60 transition-opacity")}>
			<DataTableToolbar table={table} />
		</DataTable>
	);
}
