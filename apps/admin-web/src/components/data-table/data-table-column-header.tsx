"use client";

import type * as React from "react";

import { type Column, type RowData, Subscribe } from "@tanstack/react-table";
import { cn } from "cn";

import type { DataTableFeatures } from "@/lib/data-table-features";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, ChevronsUpDown, X, EyeOff } from "lucide-react";

interface DataTableColumnHeaderProps<
  TData extends RowData,
  TValue,
> extends React.ComponentProps<typeof DropdownMenuTrigger> {
  column: Column<DataTableFeatures, TData, TValue>;
  label: string;
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  label,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return <div className={cn(className)}>{label}</div>;
  }

  return (
    <Subscribe
      source={column.table.store}
      selector={(state) => {
        const currentSort = state.sorting.find((sort) => sort.id === column.id);

        return {
          isVisible: state.columnVisibility[column.id] !== false,
          sorted: currentSort ? (currentSort.desc ? "desc" : "asc") : "none",
        } as const;
      }}
    >
      {(headerState) => (
        <DataTableColumnHeaderMenu
          column={column}
          label={label}
          className={className}
          isVisible={headerState.isVisible}
          sorted={headerState.sorted}
          {...props}
        />
      )}
    </Subscribe>
  );
}

function DataTableColumnHeaderMenu<TData extends RowData, TValue>({
  column,
  label,
  className,
  isVisible,
  sorted,
  ...props
}: DataTableColumnHeaderProps<TData, TValue> & {
  isVisible: boolean;
  sorted: "asc" | "desc" | "none";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "-ms-1.5 flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-grey/50 focus:outline-none data-[state=open]:bg-grey/50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground focus:[&_svg]:text-primary-foreground",
          className,
        )}
        {...props}
      >
        {label}
        {column.getCanSort() &&
          (sorted === "desc" ? (
            <ChevronDown
            />
          ) : sorted === "asc" ? (
            <ChevronUp
            />
          ) : (
            <ChevronsUpDown
            />
          ))}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-28">
        {column.getCanSort() && (
          <>
            <DropdownMenuCheckboxItem
              className="relative pe-8 ps-2 [&_svg]:text-muted-foreground focus:[&_svg]:text-primary-foreground [&>span:first-child]:end-2 [&>span:first-child]:start-auto"
              checked={sorted === "asc"}
              onClick={() => column.toggleSorting(false)}
            >
              <ChevronUp
              />
              Croissant
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="relative pe-8 ps-2 [&_svg]:text-muted-foreground focus:[&_svg]:text-primary-foreground [&>span:first-child]:end-2 [&>span:first-child]:start-auto"
              checked={sorted === "desc"}
              onClick={() => column.toggleSorting(true)}
            >
              <ChevronDown
              />
              Décroissant
            </DropdownMenuCheckboxItem>
            {sorted !== "none" && (
              <DropdownMenuItem
                className="ps-2 [&_svg]:text-muted-foreground"
                onClick={() => column.clearSorting()}
              >
                <X
                />
                Réinitialiser
              </DropdownMenuItem>
            )}
          </>
        )}
        {column.getCanHide() && (
          <DropdownMenuCheckboxItem
            className="relative pe-8 ps-2 [&_svg]:text-muted-foreground focus:[&_svg]:text-primary-foreground [&>span:first-child]:end-2 [&>span:first-child]:start-auto"
            checked={!isVisible}
            onClick={() => column.toggleVisibility(false)}
          >
            <EyeOff
            />
            Masquer
          </DropdownMenuCheckboxItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
