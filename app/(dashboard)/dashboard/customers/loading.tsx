import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/dashboard/skeletons"

// Mirrors customers-client.tsx's own isLoading branch: no header action
// button, and 3 stat cards (grid-cols-2 lg:grid-cols-3) — not
// TablePageSkeleton's default action button + 4-col stat grid.
export default function Loading() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <div>
        <Skeleton className="h-8 w-40 rounded-xl mb-2" />
        <Skeleton className="h-4 w-64 rounded-xl" />
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl col-span-2 lg:col-span-1" />
      </div>
      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
        <Skeleton className="h-10 w-full sm:max-w-sm rounded-full" />
        <TableSkeleton rows={10} cols={7} />
      </div>
    </div>
  )
}
