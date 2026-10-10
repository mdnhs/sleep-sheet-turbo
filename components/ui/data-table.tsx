"use client"

import React, { useState } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  PaginationState,
  VisibilityState,
  Updater,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchSlot?: React.ReactNode
  actionSlot?: React.ReactNode
  rowSelection?: Record<string, boolean>
  onRowSelectionChange?: (updater: Updater<Record<string, boolean>>) => void
  manualPagination?: boolean
  pageCount?: number
  pagination?: PaginationState
  onPaginationChange?: (updater: Updater<PaginationState>) => void
  onRowClick?: (row: TData) => void
  columnVisibility?: VisibilityState
  // Without this, TanStack keys rowSelection by the row's position, so sorting
  // or paging the table remaps every existing selection onto different rows.
  // Tables whose selection drives an action should pass a stable id.
  getRowId?: (row: TData, index: number) => string
  hideToolbar?: boolean
  toolbarClassName?: string
  onColumnVisibilityChange?: (updater: Updater<VisibilityState>) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchSlot,
  actionSlot,
  rowSelection,
  onRowSelectionChange,
  manualPagination = false,
  pageCount,
  pagination: externalPagination,
  onPaginationChange,
  onRowClick,
  columnVisibility: initialColumnVisibility,
  getRowId,
  hideToolbar = false,
  toolbarClassName,
  onColumnVisibilityChange,
}: DataTableProps<TData, TValue>) {
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>(initialColumnVisibility ?? {})
  const columnVisibility = onColumnVisibilityChange ? (initialColumnVisibility ?? {}) : internalColumnVisibility
  const setColumnVisibility = onColumnVisibilityChange ?? setInternalColumnVisibility
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<SortingState>([])

  const pagination = manualPagination ? (externalPagination ?? internalPagination) : internalPagination
  const setPagination = manualPagination
    ? (onPaginationChange ?? setInternalPagination)
    : setInternalPagination

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(getRowId ? { getRowId } : {}),
    ...(manualPagination
      ? { pageCount: pageCount ?? -1, manualPagination: true as const }
      : { getPaginationRowModel: getPaginationRowModel() }),
    onRowSelectionChange: onRowSelectionChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      rowSelection: rowSelection ?? {},
      columnVisibility,
      pagination,
      sorting,
    },
  })

  return (
    <div className="space-y-4">
      {!hideToolbar && (
        <div className={cn("flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3", toolbarClassName)}>
          <div className="flex-1 w-full min-w-0">
            {searchSlot}
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0">
            {actionSlot}
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "outline", className: "rounded-full text-xs font-semibold h-8 px-3 bg-slate-50 dark:bg-muted/40 border-none shadow-none gap-1 shrink-0 text-slate-700 dark:text-slate-200" })}>
                Columns <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize text-xs font-medium"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-hidden overflow-x-auto w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <Table>
          <TableHeader className="bg-slate-50/70 dark:bg-muted/30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-slate-100 dark:border-slate-800">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {header.isPlaceholder ? null : (
                        header.column.getCanSort() && header.id !== "select" && header.id !== "actions" ? (
                          <Button
                            variant="ghost"
                            className="-ml-4 h-8 data-[state=open]:bg-accent font-bold"
                            onClick={() => header.column.toggleSorting(header.column.getIsSorted() === "asc")}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: <ArrowUp className="ml-2 h-4 w-4" />,
                              desc: <ArrowDown className="ml-2 h-4 w-4" />,
                            }[header.column.getIsSorted() as string] ?? (
                              <ArrowUpDown className="ml-2 h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "hover:bg-slate-50/50 dark:hover:bg-muted/40 transition-colors whitespace-nowrap border-b border-slate-100 dark:border-slate-800/60",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1">
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length > 0 ? (
              `${table.getFilteredSelectedRowModel().rows.length} of ${table.getFilteredRowModel().rows.length} row(s) selected.`
            ) : (
              `Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount() || 1}`
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page</span>
            <Select
              value={table.getState().pagination.pageSize.toString()}
              onValueChange={(value) => {
                if (!value) return
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger className="h-8 w-[70px] rounded-lg text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()} className="text-xs font-medium">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center space-x-1.5 overflow-x-auto max-w-full overflow-y-hidden py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-lg h-8 px-2.5 text-xs"
          >
            Previous
          </Button>

          {(() => {
            const pageIndex = table.getState().pagination.pageIndex;
            const totalPages = table.getPageCount();
            if (totalPages <= 0) return null;

            const pages: (number | string)[] = [];
            if (totalPages <= 7) {
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              const current = pageIndex + 1;
              pages.push(1);
              if (current > 3) pages.push("...");

              const start = Math.max(2, current - 1);
              const end = Math.min(totalPages - 1, current + 1);

              for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
              }

              if (current < totalPages - 2) pages.push("...");
              pages.push(totalPages);
            }

            return pages.map((p, idx) =>
              typeof p === "number" ? (
                <Button
                  key={idx}
                  variant={pageIndex + 1 === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => table.setPageIndex(p - 1)}
                  className={cn(
                    "rounded-lg h-8 w-8 p-0 text-xs font-semibold shrink-0",
                    pageIndex + 1 === p && "pointer-events-none"
                  )}
                >
                  {p}
                </Button>
              ) : (
                <span key={idx} className="px-1 text-xs text-muted-foreground shrink-0">
                  {p}
                </span>
              )
            );
          })()}

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-lg h-8 px-2.5 text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
