"use client";

import type * as React from "react";
import { cn } from "cn";

import { type Column, type RowData, Subscribe } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { Option } from "@/lib/data-table-types";

import { Button } from "@/components/ui/button";
import {
  Faceted,
  FacetedClear,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedSeparator,
  FacetedTrigger,
  FacetedValue,
} from "@/components/ui/faceted";
import { Separator } from "@/components/ui/separator";
import { XCircle, PlusCircle } from "lucide-react";
import { focusRing } from "@/lib/focus-ring"

interface DataTableFacetedFilterProps<TData extends RowData, TValue> {
  column?: Column<DataTableFeatures, TData, TValue>;
  title?: string;
  options: Option[];
  multiple?: boolean;
}

export function DataTableFacetedFilter<TData extends RowData, TValue>({
  column,
  ...props
}: DataTableFacetedFilterProps<TData, TValue>) {
  if (!column) {
    return <DataTableFacetedFilterContent column={column} {...props} />;
  }

  return (
    <Subscribe
      source={column.table.atoms.columnFilters}
      selector={() => column.getFilterValue()}
    >
      {(filterValue) => (
        <DataTableFacetedFilterContent
          column={column}
          columnFilterValue={filterValue}
          {...props}
        />
      )}
    </Subscribe>
  );
}

interface DataTableFacetedFilterContentProps<
  TData extends RowData,
  TValue,
> extends DataTableFacetedFilterProps<TData, TValue> {
  columnFilterValue?: unknown;
}

function DataTableFacetedFilterContent<TData extends RowData, TValue>({
  column,
  title,
  options,
  multiple = false,
  columnFilterValue,
}: DataTableFacetedFilterContentProps<TData, TValue>) {
  const selectedValues = Array.isArray(columnFilterValue)
    ? columnFilterValue.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const hasSelection = selectedValues.length > 0;

  function onValueChange(value: string | string[] | undefined) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    column?.setFilterValue(values.length > 0 ? values : undefined);
  }

  function onReset(event?: React.MouseEvent) {
    event?.stopPropagation();
    column?.setFilterValue(undefined);
  }

  return (
    <Faceted
      value={multiple ? selectedValues : selectedValues[0]}
      onValueChange={onValueChange}
      items={options}
      multiple={multiple}
    >
      <FacetedTrigger asChild>
        <Button variant="outline">
          {hasSelection ? (
            <div
              role="button"
              aria-label={`Effacer le filtre ${title}`}
              tabIndex={0}
              className={cn(focusRing, "rounded-sm opacity-70 transition-opacity hover:opacity-100")}
              onClick={onReset}
            >
              <XCircle
              />
            </div>
          ) : (
            <PlusCircle
            />
          )}
          {title}
          {hasSelection && (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-vertical:h-4 data-vertical:self-center"
              />
              <FacetedValue />
            </>
          )}
        </Button>
      </FacetedTrigger>
      <FacetedContent className="w-50">
        <FacetedInput placeholder={title} />
        <FacetedList className="max-h-full">
          <FacetedEmpty>Aucun résultat.</FacetedEmpty>
          <FacetedGroup className="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto">
            {options.map((option) => (
              <FacetedItem key={option.value} value={option.value}>
                {option.icon && <option.icon />}
                <span className="flex-1 truncate">{option.label}</span>
                <FacetedItemIndicator>{option.count}</FacetedItemIndicator>
              </FacetedItem>
            ))}
          </FacetedGroup>
          {hasSelection && (
            <>
              <FacetedSeparator />
              <FacetedGroup>
                <FacetedClear>Effacer les filtres</FacetedClear>
              </FacetedGroup>
            </>
          )}
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}
