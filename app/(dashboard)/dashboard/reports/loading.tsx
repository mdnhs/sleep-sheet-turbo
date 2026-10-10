import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/dashboard/skeletons"

// Reports has no charts — it's 6 stat cards (grid-cols-2 lg:grid-cols-6) and
// a table, plus a pill filter row in the header. ChartsPageSkeleton (2
// side-by-side chart blocks) used to render here and had nothing in common
// with the real layout.
export default function Loading() {
  return (
    <div className="flex-col">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <div className="flex flex-wrap items-center gap-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
            <Skeleton className="h-8 w-36 rounded-full" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
          <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
            <Skeleton className="h-6 w-48 rounded-xl" />
            <TableSkeleton rows={12} cols={6} />
          </div>
        </div>
      </div>
    </div>
  )
}
