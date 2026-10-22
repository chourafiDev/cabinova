"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarIcon, Search, Tags } from "lucide-react";
import { useMemo } from "react";
import { fmt } from "@/calendar/locale";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import { actionLabel, type AuditLogRow, ENTITY_LABELS, formatMetadata } from "@/lib/audit";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { useListTransition } from "../../_components/shared/list-transition";

const ENTITY_OPTIONS = Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }));

export function ActivityLogTable({ data, pageCount }: { data: AuditLogRow[]; pageCount: number }) {
	const { isPending, startTransition } = useListTransition();

	const columns = useMemo<ColumnDef<DataTableFeatures, AuditLogRow>[]>(
		() => [
			{
				id: "createdAt",
				accessorKey: "createdAt",
				header: "Date",
				cell: ({ row }) => (
					<div className="grid leading-tight whitespace-nowrap">
						<span className="font-medium">{fmt(new Date(row.original.createdAt), "d MMM yyyy")}</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{fmt(new Date(row.original.createdAt), "HH:mm")}
						</span>
					</div>
				),
				meta: { label: "Date", variant: "dateRange", icon: CalendarIcon },
				enableColumnFilter: true,
				enableHiding: false,
			},
			{
				id: "member",
				accessorFn: (row) => row.user?.name ?? "",
				header: "Membre",
				cell: ({ row }) =>
					row.original.user ? (
						<div className="grid leading-tight">
							<span className="font-medium">{row.original.user.name}</span>
							<span className="text-muted-foreground text-xs">{row.original.user.email}</span>
						</div>
					) : (
						<span className="text-muted-foreground italic">Compte supprimé</span>
					),
				meta: { label: "Membre", placeholder: "Nom ou e-mail…", variant: "text", icon: Search },
				enableColumnFilter: true,
				enableSorting: false,
			},
			{
				id: "action",
				header: "Action",
				cell: ({ row }) => actionLabel(row.original.action),
				meta: { label: "Action" },
				enableSorting: false,
			},
			{
				id: "entity",
				accessorKey: "entity",
				header: "Entité",
				cell: ({ row }) => ENTITY_LABELS[row.original.entity],
				meta: { label: "Entité", variant: "multiSelect", options: ENTITY_OPTIONS, icon: Tags },
				enableColumnFilter: true,
				enableSorting: false,
			},
			{
				id: "metadata",
				header: "Détails",
				cell: ({ row }) => {
					const details = formatMetadata(row.original.metadata);
					return details ? (
						<span className="text-muted-foreground text-xs">{details}</span>
					) : (
						<span className="text-muted-foreground">—</span>
					);
				},
				meta: { label: "Détails" },
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
		initialState: { pagination: { pageIndex: 0, pageSize: 20 } },
		shallow: false, // re-run the server query when the URL changes
		startTransition,
	});

	return (
		<DataTable table={table} className={isPending ? "opacity-60 transition-opacity" : undefined}>
			<DataTableToolbar table={table} />
		</DataTable>
	);
}
