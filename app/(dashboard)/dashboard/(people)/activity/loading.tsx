import { PageHeaderSkeleton, StatCardsSkeleton, FilterBarSkeleton, TableSkeleton, PaginationSkeleton } from "@/components/dashboard/skeletons"

// Activity Log always renders its own 2-card stat row (Total Events /
// Things That Went Wrong) above the table — the shared TablePageSkeleton
// reserved no space for it, so the table jumped down once the page mounted.
export default function Loading() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <PageHeaderSkeleton action={false} />
      <StatCardsSkeleton count={2} cols="grid-cols-2" />
      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 space-y-4">
        <FilterBarSkeleton />
        <TableSkeleton />
        <PaginationSkeleton />
      </div>
    </div>
  )
}
