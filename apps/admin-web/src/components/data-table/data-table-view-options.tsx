"use client";

import { type RowData, Subscribe, type Table } from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { Button } from "@/components/ui/button";
import {
  Faceted,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedTrigger,
} from "@/components/ui/faceted";
import { LuSettings2 } from "react-icons/lu";

interface DataTableViewOptionsProps<
  TData extends RowData,
> extends React.ComponentProps<typeof FacetedContent> {
  table: Table<DataTableFeatures, TData>;
  disabled?: boolean;
}

export function DataTableViewOptions<TData extends RowData>({
  table,
  disabled,
  className,
  ...props
}: DataTableViewOptionsProps<TData>) {
  const columns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter(
          (column) =>
            typeof column.accessorFn !== "undefined" && column.getCanHide(),
        ),
    [table],
  );

  return (
    <Subscribe source={table.atoms.columnVisibility}>
      {(columnVisibility) => (
        <Faceted
          multiple
          value={columns
            .filter((column) => columnVisibility[column.id] !== false)
            .map((column) => column.id)}
        >
          <FacetedTrigger asChild>
            <Button
              aria-label="Afficher ou masquer des colonnes"
              role="combobox"
              variant="outline"
              className="ms-auto hidden lg:flex"
              disabled={disabled}
            >
              <LuSettings2 className="text-muted-foreground" />
              Colonnes
            </Button>
          </FacetedTrigger>
          <FacetedContent
            align="center"
            className={cn("w-44", className)}
            {...props}
          >
            <FacetedInput placeholder="Rechercher une colonne…" />
            <FacetedList>
              <FacetedEmpty>Aucune colonne.</FacetedEmpty>
              <FacetedGroup>
                {columns.map((column) => (
                  <FacetedItem
                    key={column.id}
                    value={column.id}
                    onSelect={() => column.toggleVisibility()}
                  >
                    <span className="truncate">
                      {column.columnDef.meta?.label ?? column.id}
                    </span>
                    <FacetedItemIndicator />
                  </FacetedItem>
                ))}
              </FacetedGroup>
            </FacetedList>
          </FacetedContent>
        </Faceted>
      )}
    </Subscribe>
  );
}
