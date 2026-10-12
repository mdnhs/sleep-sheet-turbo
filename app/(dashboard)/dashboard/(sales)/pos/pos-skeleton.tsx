import { Skeleton } from "@/components/ui/skeleton"
import { CardGridSkeleton } from "@/components/dashboard/skeletons"

export function PosSkeleton() {
  return (
    <div className="flex-1 grid gap-4 p-4 md:p-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Skeleton className="h-10 w-full rounded-full" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <CardGridSkeleton count={8} />
      </div>
      <div className="space-y-3 rounded-3xl bg-white dark:bg-card p-4">
        <Skeleton className="h-6 w-24" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-2xl" />
        ))}
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  )
}
