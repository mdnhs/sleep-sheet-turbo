import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/dashboard/skeletons"

// Mirrors testimonials-client.tsx's own isLoading branch — a real 10-row
// table skeleton (not a single short box, which collapsed ~500px of real
// table height into ~250px and jumped when the table mounted).
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
        <TableSkeleton rows={10} cols={6} />
      </div>
    </div>
  )
}
