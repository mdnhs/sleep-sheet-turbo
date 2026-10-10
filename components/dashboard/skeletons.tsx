import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const PAGE_WRAPPER = "flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6"

export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-4 w-64 max-w-full rounded-xl" />
      </div>
      {action && <Skeleton className="h-9 w-28 rounded-full shrink-0" />}
    </div>
  )
}

export function StatCardsSkeleton({
  count = 4,
  cols = "grid-cols-2 lg:grid-cols-4",
}: { count?: number; cols?: string }) {
  return (
    <div className={cn("grid gap-3 sm:gap-4", cols)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-3xl sm:min-h-[136px]" />
      ))}
    </div>
  )
}

export function TabBarSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="flex items-center gap-1 h-10 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-card p-1">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
      ))}
    </div>
  )
}

export function FilterBarSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
      <Skeleton className="h-9 w-full sm:flex-1 rounded-full" />
      <div className="grid grid-cols-2 sm:flex gap-2.5">
        <Skeleton className="h-8 sm:w-[170px] rounded-full" />
        <Skeleton className="h-8 sm:w-[140px] rounded-full" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center gap-4 bg-slate-50/70 dark:bg-muted/30 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 rounded-md" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 px-4 py-3 border-t border-slate-100 dark:border-slate-800/60"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-5 flex-1 rounded-md", c === 0 && "max-w-10 h-10")} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <Skeleton className="h-8 w-48 rounded-lg" />
    </div>
  )
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
        >
          <Skeleton className="aspect-square rounded-none" />
          <div className="p-4 space-y-2.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
            <div className="flex justify-between pt-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-2xl" />
      ))}
    </div>
  )
}

export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5 rounded-3xl bg-white dark:bg-card p-4 sm:p-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className={cn("w-full rounded-xl", i === fields - 1 ? "h-32" : "h-10")} />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
    </div>
  )
}

export function BlogFormSkeleton({ title = "h-8 w-48" }: { title?: string }) {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 max-w-5xl mx-auto">
      <div className="space-y-2">
        <Skeleton className={cn(title, "rounded-xl")} />
        <Skeleton className="h-4 w-64 rounded-xl" />
      </div>
      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-72 w-full rounded-3xl", className)} />
}

/* ---------- full-page presets (used by route loading.tsx files) ---------- */

export function TablePageSkeleton({
  stats = false,
  action = true,
  tabs = false,
}: { stats?: boolean; action?: boolean; tabs?: boolean } = {}) {
  return (
    <div className={PAGE_WRAPPER}>
      <PageHeaderSkeleton action={action} />
      {stats && <StatCardsSkeleton />}
      {tabs && <TabBarSkeleton />}
      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 space-y-4">
        <FilterBarSkeleton />
        <TableSkeleton />
        <PaginationSkeleton />
      </div>
    </div>
  )
}

export function GridPageSkeleton() {
  return (
    <div className={PAGE_WRAPPER}>
      <PageHeaderSkeleton />
      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 space-y-4">
        <FilterBarSkeleton />
        <CardGridSkeleton />
      </div>
    </div>
  )
}

export function DashboardHomeSkeleton() {
  return (
    <div className={PAGE_WRAPPER}>
      <PageHeaderSkeleton action={false} />
      <StatCardsSkeleton count={8} />
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartSkeleton className="lg:col-span-2" />
        <ChartSkeleton />
      </div>
      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6">
        <TableSkeleton rows={5} cols={5} />
      </div>
    </div>
  )
}

export function ProductFormSkeleton() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <Skeleton className="h-9 w-64 rounded-xl" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-2/3 rounded-xl border bg-card p-6 space-y-5">
          <Skeleton className="h-7 w-52 rounded-lg" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="w-full lg:w-1/3 rounded-xl border bg-card p-6 space-y-5">
          <Skeleton className="h-7 w-40 rounded-lg" />
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
      <Skeleton className="h-11 w-full sm:w-[120px] rounded-md" />
    </div>
  )
}

export function FormPageSkeleton({ fields }: { fields?: number }) {
  return (
    <div className={PAGE_WRAPPER}>
      <PageHeaderSkeleton />
      <FormSkeleton fields={fields} />
    </div>
  )
}

export function ListPageSkeleton({ rows }: { rows?: number }) {
  return (
    <div className={cn(PAGE_WRAPPER, "max-w-5xl mx-auto w-full")}>
      <PageHeaderSkeleton />
      <ListSkeleton rows={rows} />
    </div>
  )
}

export function ChartsPageSkeleton() {
  return (
    <div className={PAGE_WRAPPER}>
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  )
}
