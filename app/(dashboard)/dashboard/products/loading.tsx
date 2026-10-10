import { Skeleton } from "@/components/ui/skeleton"
import { FilterBarSkeleton, CardGridSkeleton, PaginationSkeleton } from "@/components/dashboard/skeletons"

// Mirrors client.tsx's own isLoading branch: tighter mobile padding than the
// shared PAGE_WRAPPER, a header with an action button + 3-icon view
// switcher, and a card-grid body (the default view) instead of the generic
// GridPageSkeleton's full-padding, switcher-less header.
export default function Loading() {
  return (
    <div className="flex-1 space-y-3 sm:space-y-6 p-2 sm:p-4 md:p-8 pt-2 sm:pt-4 md:pt-6">
      <div className="flex items-center justify-end sm:justify-between gap-3">
        <div className="hidden sm:block space-y-2">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <Skeleton className="h-4 w-56 rounded-xl" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
      <div className="rounded-3xl bg-white dark:bg-card p-2 sm:p-6 space-y-2 sm:space-y-4">
        <FilterBarSkeleton />
        <CardGridSkeleton count={10} />
        <PaginationSkeleton />
      </div>
    </div>
  )
}
