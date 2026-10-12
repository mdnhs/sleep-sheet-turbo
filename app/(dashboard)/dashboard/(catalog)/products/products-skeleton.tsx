import { PageTitle } from "@/components/dashboard-page-title"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Mirrors client.tsx block by block: the action row (Add New + 3-icon view
// switcher), then the white card holding the view-specific body — the card
// grid (default view), the DataTable, or the duplicate-image groups.

export type ProductsView = "grid" | "table" | "duplicates"

/** Most cards / rows / groups a skeleton draws per view (grid and table: one page at most). */
export const PRODUCTS_SKELETON_MAX: Record<ProductsView, number> = { grid: 12, table: 10, duplicates: 3 }

const SELECT = "h-8 rounded-full"

/** Add New button + table/grid/duplicates view switcher. */
export function ProductsActionsSkeleton() {
  return (
    <div className="flex items-center justify-end gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <Skeleton className="h-9 w-26 rounded-full" />
        <div className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-muted/40 p-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-7 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Search + category + featured + sort (`filterBar`). */
export function ProductsFilterBarSkeleton() {
  return (
    <div className="flex flex-wrap sm:flex-nowrap items-stretch sm:items-center gap-2.5 w-full">
      <Skeleton className="h-9 flex-1 min-w-35 sm:min-w-50 rounded-full" />
      <Skeleton className={cn(SELECT, "w-32.5 sm:w-42.5")} />
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
        <Skeleton className={cn(SELECT, "w-full sm:w-35")} />
        <Skeleton className={cn(SELECT, "w-full sm:w-42.5")} />
      </div>
    </div>
  )
}

/** Search + category (`duplicatesFilterBar`). */
export function ProductsDuplicatesFilterBarSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
      <Skeleton className="h-9 w-full sm:flex-1 sm:min-w-50 rounded-full" />
      <Skeleton className={cn(SELECT, "w-full sm:w-42.5")} />
    </div>
  )
}

/** One grid-view product card: image, name/category + actions, price/stock, featured switch. */
export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-hidden">
      <Skeleton className="aspect-square rounded-none" />
      <div className="p-2 sm:p-4 space-y-1.5 sm:space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <Skeleton className="mt-2 h-3 w-14 rounded-md" />
          <Skeleton className="mt-2 h-4.5 w-8 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function ProductCardGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** "Page x of y" + per-page select on the left, Previous/Next (grid view; DataTable adds page numbers). */
export function ProductsPaginationSkeleton({ pageNumbers = false }: { pageNumbers?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1">
      <div className="flex items-center gap-3">
        <Skeleton className="h-3.5 w-20 rounded-md" />
        <div className="flex items-center gap-1.5 shrink-0">
          <Skeleton className="h-3.5 w-16 rounded-md" />
          <Skeleton className="h-8 w-17.5 rounded-lg" />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-8 w-18 rounded-lg" />
        {pageNumbers && <Skeleton className="h-8 w-8 rounded-lg" />}
        <Skeleton className="h-8 w-12 rounded-lg" />
      </div>
    </div>
  )
}

// select, image, name, category, price, stock, featured, date added, actions
const TABLE_CELLS = [
  "h-4 w-4 rounded",
  "h-10 w-10 rounded",
  "h-4 w-40",
  "h-4 w-20",
  "h-4 w-16",
  "h-4 w-8",
  "h-4.5 w-8 rounded-full",
  "h-4 w-20",
  "ml-auto h-8 w-17 rounded-lg",
]

/** Table view: DataTable with the filter bar as its search slot + Columns menu. */
export function ProductsTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 w-full min-w-0">
          <ProductsFilterBarSkeleton />
        </div>
        <div className="flex items-center justify-end gap-2 shrink-0">
          <Skeleton className="h-8 w-22 rounded-full" />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-hidden overflow-x-auto w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full">
          <thead className="bg-slate-50/70 dark:bg-muted/30">
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {TABLE_CELLS.map((_, i) => (
                <th key={i} className="h-12 px-3">
                  <Skeleton className={cn("h-4 rounded-md", i === 0 ? "w-4" : "w-14", i === TABLE_CELLS.length - 1 && "ml-auto")} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                {TABLE_CELLS.map((cell, c) => (
                  <td key={c} className="p-3">
                    <Skeleton className={cn("rounded-md", cell)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ProductsPaginationSkeleton pageNumbers />
    </div>
  )
}

/** Duplicates view body: one card per shared image. */
export function ProductsDuplicateGroupsSkeleton({ count = PRODUCTS_SKELETON_MAX.duplicates }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  )
}

/** Duplicates view: filter bar + one card per shared image. */
export function ProductsDuplicatesSkeleton({ count }: { count?: number }) {
  return (
    <div className="space-y-2 sm:space-y-4">
      <ProductsDuplicatesFilterBarSkeleton />
      <ProductsDuplicateGroupsSkeleton count={count} />
    </div>
  )
}

/** The white card's body for the current view. */
export function ProductsBodySkeleton({ view = "grid", count = 10 }: { view?: ProductsView; count?: number }) {
  if (view === "duplicates") return <ProductsDuplicatesSkeleton count={Math.min(count, PRODUCTS_SKELETON_MAX.duplicates)} />
  if (view === "table") return <ProductsTableSkeleton rows={Math.min(count, PRODUCTS_SKELETON_MAX.table)} />
  return (
    <div className="space-y-2 sm:space-y-4">
      <ProductsFilterBarSkeleton />
      <ProductCardGridSkeleton count={Math.min(count, PRODUCTS_SKELETON_MAX.grid)} />
      <ProductsPaginationSkeleton />
    </div>
  )
}

export function ProductsPageSkeleton({ view = "grid", count = 10 }: { view?: ProductsView; count?: number }) {
  return (
    <div className="flex-1 space-y-3 sm:space-y-6 p-2 sm:p-4 md:p-8 pt-2 sm:pt-4 md:pt-6">
      <PageTitle title="Products" description="Manage your product catalog and inventory" />
      <ProductsActionsSkeleton />
      <div className="rounded-3xl bg-white dark:bg-card p-2 sm:p-6 border-none shadow-none space-y-2 sm:space-y-4">
        <ProductsBodySkeleton view={view} count={count} />
      </div>
    </div>
  )
}
