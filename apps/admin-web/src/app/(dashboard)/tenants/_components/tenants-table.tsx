"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CircleDot, Search } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/hooks/use-data-table";
import type { DataTableFeatures } from "@/lib/data-table-features";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS, type TenantRow } from "@/lib/tenants";
import { cn } from "@/lib/utils";
import { useListTransition } from "../../_components/shared/list-transition";
import { TenantStatusBadge } from "./tenant-status-badge";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

export function TenantsTable({ data, pageCount }: { data: TenantRow[]; pageCount: number }) {
	const { isPending, startTransition } = useListTransition();

	const columns = useMemo<ColumnDef<DataTableFeatures, TenantRow>[]>(
		() => [
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => <DataTableColumnHeader column={column} label="Cabinet" />,
				cell: ({ row }) => (
					<Link href={`/tenants/${row.original.id}`} className="group/name grid leading-tight">
						<span className="font-medium group-hover/name:underline">{row.original.name}</span>
						<span className="text-muted-foreground text-xs">{row.original.responsibleName}</span>
					</Link>
				),
				meta: { label: "Cabinet", placeholder: "Nom, responsable ou e-mail…", variant: "text", icon: Search },
				enableColumnFilter: true,
				enableHiding: false,
			},
			{
				id: "specialty",
				header: "Spécialité",
				cell: ({ row }) => row.original.specialty ?? <span className="text-muted-foreground">—</span>,
				meta: { label: "Spécialité" },
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
				id: "email",
				header: "E-mail",
				cell: ({ row }) => <span className="whitespace-nowrap">{row.original.email}</span>,
				meta: { label: "E-mail" },
				enableSorting: false,
			},
			{
				id: "status",
				accessorKey: "status",
				header: "Statut",
				cell: ({ row }) => <TenantStatusBadge status={row.original.status} />,
				meta: {
					label: "Statut",
					variant: "multiSelect",
					options: STATUS_OPTIONS,
					icon: CircleDot,
				},
				enableColumnFilter: true,
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
				meta: { label: "Créé le" },
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
			sorting: [{ id: "createdAt", desc: true }],
			pagination: { pageIndex: 0, pageSize: 20 },
		},
		shallow: false, // re-run the server query when the URL changes
		startTransition,
	});

	return (
		<DataTable table={table} className={cn(isPending && "opacity-60 transition-opacity")}>
			<DataTableToolbar table={table} />
		</DataTable>
	);
}
