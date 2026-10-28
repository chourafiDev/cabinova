"use client";

import type * as React from "react";

import { type RowData, Subscribe, type Table } from "@tanstack/react-table";
import { cn } from "cn";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LuChevronLeft, LuChevronRight, LuChevronsLeft, LuChevronsRight } from "react-icons/lu";

interface DataTablePaginationProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  table: Table<DataTableFeatures, TData>;
  pageSizeOptions?: number[];
}

export function DataTablePagination<TData extends RowData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  return (
    <Subscribe
      source={table.store}
      selector={(state) => ({
        pageIndex: state.pagination.pageIndex,
        pageSize: state.pagination.pageSize,
        selectedRowCount: table.getSelectedRowIds().length,
      })}
    >
      {({ pageIndex, pageSize, selectedRowCount }) => (
        <DataTablePaginationContent
          table={table}
          pageIndex={pageIndex}
          pageSize={pageSize}
          selectedRowCount={selectedRowCount}
          pageSizeOptions={pageSizeOptions}
          className={className}
          {...props}
        />
      )}
    </Subscribe>
  );
}

interface DataTablePaginationContentProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  table: Table<DataTableFeatures, TData>;
  pageIndex: number;
  pageSize: number;
  selectedRowCount: number;
  pageSizeOptions: number[];
}

function DataTablePaginationContent<TData extends RowData>({
  table,
  pageIndex,
  pageSize,
  selectedRowCount,
  pageSizeOptions,
  className,
  ...props
}: DataTablePaginationContentProps<TData>) {
  const pageCount = table.getPageCount();
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();

  return (
    <div
      className={cn(
        "flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8",
        className,
      )}
      {...props}
    >
      {/* Only meaningful on tables with row selection. */}
      <div className="flex-1 text-sm whitespace-nowrap text-muted-foreground">
        {selectedRowCount > 0 &&
          `${selectedRowCount} ligne${selectedRowCount > 1 ? "s" : ""} sélectionnée${selectedRowCount > 1 ? "s" : ""}`}
      </div>
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <p className="text-sm font-medium whitespace-nowrap">Lignes par page</p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="w-18">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {pageSizeOptions.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center text-sm font-medium">
          Page {pageIndex + 1} sur {pageCount}
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <Button
            aria-label="Première page"
            variant="outline"
            size="icon"
            className="hidden lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!canPreviousPage}
          >
            <LuChevronsLeft
            />
          </Button>
          <Button
            aria-label="Page précédente"
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!canPreviousPage}
          >
            <LuChevronLeft
            />
          </Button>
          <Button
            aria-label="Page suivante"
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!canNextPage}
          >
            <LuChevronRight
            />
          </Button>
          <Button
            aria-label="Dernière page"
            variant="outline"
            size="icon"
            className="hidden lg:flex"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!canNextPage}
          >
            <LuChevronsRight
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
