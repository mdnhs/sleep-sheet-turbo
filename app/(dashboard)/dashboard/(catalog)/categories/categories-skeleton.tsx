"use client"

import { PageTitle } from "@/components/dashboard-page-title"
import { Skeleton } from "@/components/ui/skeleton"
import { useSkeletonRows } from "@/hooks/use-skeleton-rows"
import { cn } from "@/lib/utils"

// Mirrors categories-client.tsx: the "add category" action row, then the
// white card with the search bar, the draggable 8-column table, and the
// "n of m row(s) selected" footer.

/** Right-aligned "Add Category" dialog trigger. */
export function CategoriesActionsSkeleton() {
  return (
    <div className="flex items-center justify-end gap-4">
      <Skeleton className="h-9 w-36 rounded-full" />
    </div>
  )
}

export function CategoriesSearchSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-60">
        <Skeleton className="h-9 w-full max-w-sm rounded-full" />
      </div>
    </div>
  )
}

// drag handle, select, image, label, slug, parent, subcategories, actions
const HEADS = ["w-4", "w-4", "w-12", "w-16", "w-10", "w-12", "w-24", "ml-auto w-14"]

function CategoryRowSkeleton() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      <td className="w-10 px-3 py-2.5">
        <Skeleton className="h-4 w-4 rounded" />
      </td>
      <td className="w-10 px-3 py-2.5">
        <Skeleton className="h-4 w-4 rounded" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-10 w-10 rounded-xl" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-4 w-28 rounded-md" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-5 w-24 rounded-lg" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-4 w-20 rounded-md" />
      </td>
      <td className="px-3 py-2.5">
        <Skeleton className="h-5 w-8 rounded-full" />
      </td>
      <td className="px-2 py-2">
        <Skeleton className="ml-auto size-8 rounded-lg" />
      </td>
    </tr>
  )
}

/**
 * The draggable table isn't paged (every category renders), so rows are what
 * it showed last time, capped at 8 — about a screenful.
 */
export function CategoriesTableSkeleton() {
  const rows = useSkeletonRows("categories.list", 8)
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-hidden overflow-x-auto w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full">
        <thead className="bg-slate-50/70 dark:bg-muted/30">
          <tr className="border-b border-slate-100 dark:border-slate-800">
            {HEADS.map((width, i) => (
              <th key={i} className="px-3 py-3">
                <Skeleton className={cn("h-4 rounded-md", width)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <CategoryRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CategoriesFooterSkeleton() {
  return (
    <div className="flex items-center justify-between px-2 py-1">
      <Skeleton className="h-3.5 w-32 rounded-md" />
    </div>
  )
}

export function CategoriesPageSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <PageTitle title="Categories" description="Organize products into categories and subcategories" />
      <CategoriesActionsSkeleton />
      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
        <CategoriesSearchSkeleton />
        <CategoriesTableSkeleton />
        <CategoriesFooterSkeleton />
      </div>
    </div>
  )
}
