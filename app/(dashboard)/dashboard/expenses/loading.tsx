import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/dashboard/skeletons"

// Mirrors expenses-client.tsx: `max-w-6xl mx-auto` (not full-bleed like the
// shared PAGE_WRAPPER), a 2-button header, 3 stat cards, and a pill
// date-filter row + category select above the table.
export default function Loading() {
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Skeleton className="h-8 w-32 rounded-xl mb-2" />
          <Skeleton className="h-4 w-56 rounded-xl" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Skeleton className="h-9 w-32 rounded-full flex-1 sm:flex-none" />
          <Skeleton className="h-9 w-32 rounded-full flex-1 sm:flex-none" />
        </div>
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl col-span-2 lg:col-span-1" />
      </div>
      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Skeleton className="h-6 w-32 rounded-md" />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <Skeleton className="h-8 w-full sm:w-48 rounded-full" />
          </div>
        </div>
        <TableSkeleton rows={6} cols={5} />
      </div>
    </div>
  )
}
