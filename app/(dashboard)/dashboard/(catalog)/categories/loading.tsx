import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/dashboard/skeletons"

// Mirrors categories-client.tsx's own isLoading branch: full-width header
// with an action button, search bar, and a real multi-row table skeleton —
// not the shared ListPageSkeleton's centered pill list (wrong shape/width),
// and not a single short box (collapses the real 8-column table's height).
export default function Loading() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-40 rounded-xl mb-2" />
          <Skeleton className="h-4 w-64 rounded-xl" />
        </div>
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
        <Skeleton className="h-10 w-full sm:max-w-sm rounded-full" />
        <TableSkeleton rows={8} cols={8} />
      </div>
    </div>
  )
}
