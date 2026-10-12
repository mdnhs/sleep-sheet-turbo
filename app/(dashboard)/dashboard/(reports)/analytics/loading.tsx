import { Skeleton } from "@/components/ui/skeleton"

// Analytics has no charts on this route (GA4 is embedded/deep-linked, not
// rendered here) and no internal isLoading gate — it's a header + badge
// row, a 4-card "quick launch" grid, and a 3-tab section. ChartsPageSkeleton
// (stat cards + 2 chart blocks) had nothing in common with this shape.
export default function Loading() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-7 w-72 rounded-xl" />
          </div>
          <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-72 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <Skeleton className="h-9 w-64 rounded-lg" />
        {/* Default "funnel" tab: a step-grid card + a 3-card advice grid —
            a single h-72 box here used to reserve about half this tab's
            real ~600px height. */}
        <div className="rounded-xl border p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-72 rounded-md" />
            <Skeleton className="h-4 w-96 max-w-full rounded-md" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
