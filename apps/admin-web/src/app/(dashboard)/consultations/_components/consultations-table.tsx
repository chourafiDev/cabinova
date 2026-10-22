"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CircleDot, Search } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { fmt } from "@/calendar/locale";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { CONSULTATION_STATUS_LABELS, type ConsultationRow } from "@/lib/consultations";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { formatFileNumber, fullName } from "@/lib/patients";
import { cn } from "@/lib/utils";
import { useListTransition } from "../../_components/shared/list-transition";
import { ConsultationStatusBadge } from "./consultation-status-badge";

const STATUS_OPTIONS = Object.entries(CONSULTATION_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export function ConsultationsTable({ data, pageCount }: { data: ConsultationRow[]; pageCount: number }) {
	const { isPending, startTransition } = useListTransition();

	const columns = useMemo<ColumnDef<DataTableFeatures, ConsultationRow>[]>(
		() => [
			{
				id: "startedAt",
				accessorKey: "startedAt",
				header: ({ column }) => <DataTableColumnHeader column={column} label="Date" />,
				cell: ({ row }) => (
					<Link href={`/consultations/${row.original.id}`} className="grid leading-tight hover:underline">
						<span className="font-medium whitespace-nowrap">{fmt(new Date(row.original.startedAt), "d MMM yyyy")}</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{fmt(new Date(row.original.startedAt), "HH:mm")}
						</span>
					</Link>
				),
				meta: { label: "Date" },
				enableHiding: false,
			},
			{
				id: "patient",
				accessorFn: (row) => fullName(row.patient),
				header: "Patient",
				cell: ({ row }) => (
					<Link href={`/patients/${row.original.patient.id}`} className="grid leading-tight hover:underline">
						<span className="font-medium">{fullName(row.original.patient)}</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{formatFileNumber(row.original.patient.fileNumber)}
						</span>
					</Link>
				),
				meta: { label: "Patient", placeholder: "Patient ou n° de dossier…", variant: "text", icon: Search },
				enableColumnFilter: true,
				enableSorting: false,
			},
			{
				id: "practitioner",
				header: "Praticien",
				cell: ({ row }) => row.original.practitioner.name,
				meta: { label: "Praticien" },
				enableSorting: false,
			},
			{
				id: "summary",
				header: "Motif / diagnostic",
				cell: ({ row }) => (
					<div className="grid max-w-80 leading-tight">
						<span className="truncate">{row.original.reason || "—"}</span>
						{row.original.diagnosis && (
							<span className="text-muted-foreground truncate text-xs">{row.original.diagnosis}</span>
						)}
					</div>
				),
				meta: { label: "Motif / diagnostic" },
				enableSorting: false,
			},
			{
				id: "status",
				accessorKey: "status",
				header: "Statut",
				cell: ({ row }) => <ConsultationStatusBadge status={row.original.status} />,
				meta: { label: "Statut", variant: "multiSelect", options: STATUS_OPTIONS, icon: CircleDot },
				enableColumnFilter: true,
				enableSorting: false,
			},
		],
		[],
	);

	const { table } = useDataTable({
		data,
		columns,
		pageCount,
		getRowId: (row) => row.id,
		initialState: {
			sorting: [{ id: "startedAt", desc: true }],
			pagination: { pageIndex: 0, pageSize: 20 },
		},
		shallow: false,
		startTransition,
	});

	return (
		<DataTable table={table} className={cn(isPending && "opacity-60 transition-opacity")}>
			<DataTableToolbar table={table} />
		</DataTable>
	);
}
