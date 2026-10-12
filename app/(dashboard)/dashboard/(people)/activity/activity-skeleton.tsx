"use client";

import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkeletonRows } from "@/hooks/use-skeleton-rows";
import { cn } from "@/lib/utils";

// Mirrors activity-client.tsx: 2 stat cards (Total Events / Things That Went
// Wrong), then a card with the Everything/Failed pill tabs + search above a
// DataTable (Columns button, 4 columns, pagination footer). The title lives
// in the navbar (<PageTitle>).

function ActivityStatCardSkeleton() {
  return (
    <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none flex flex-col justify-between min-h-30 sm:min-h-34">
      <div className="flex items-center justify-between gap-1.5">
        <Skeleton className="h-3.5 sm:h-4 w-24 sm:w-40 rounded-md" />
        <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0" />
      </div>
      <div className="mt-2.5 mb-1">
        <Skeleton className="h-5 sm:h-7 lg:h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export function ActivityStatCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2">
      <ActivityStatCardSkeleton />
      <ActivityStatCardSkeleton />
    </div>
  );
}

/** "Everything" / "Failed (n)" pill TabsList + the search input. */
export function ActivityToolbarSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div className="flex flex-nowrap items-center h-9 w-max sm:w-fit gap-1 bg-slate-100 dark:bg-muted/40 p-1 rounded-full">
        <Skeleton className="h-7 w-23 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <Skeleton className="h-9 w-full sm:w-72 rounded-full" />
    </div>
  );
}

// What happened, Done by, When, Result.
const COLUMN_WIDTHS = ["flex-1 min-w-60", "w-44", "w-28", "w-20"];

/**
 * DataTable: Columns button, 4-column table (icon + 2-line cells), pagination
 * footer. Draws as many rows as the log showed last time (up to `pageSize`,
 * the client's default `?limit=` of 20).
 */
export function ActivityTableSkeleton({ pageSize = 20 }: { pageSize?: number }) {
  const rows = useSkeletonRows("activity.list", pageSize);
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 w-full min-w-0" />
        <div className="flex items-center justify-end gap-2 shrink-0">
          <Skeleton className="h-8 w-22 rounded-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-x-auto w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-160">
          <div className="flex h-12 items-center gap-6 bg-slate-50/70 dark:bg-muted/30 px-3 border-b border-slate-100 dark:border-slate-800">
            {COLUMN_WIDTHS.map((w, i) => (
              <div key={i} className={cn("shrink-0", w)}>
                <Skeleton className="h-4 w-20 max-w-full rounded-md" />
              </div>
            ))}
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div
              key={r}
              className="flex h-16 items-center gap-6 px-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
            >
              <div className={cn("flex items-start gap-3", COLUMN_WIDTHS[0])}>
                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5 pt-0.5">
                  <Skeleton className="h-4 w-40 max-w-full rounded-md" />
                  <Skeleton className="h-3 w-56 max-w-full rounded-md" />
                </div>
              </div>
              {[1, 2].map((c) => (
                <div key={c} className={cn("shrink-0 space-y-1.5", COLUMN_WIDTHS[c])}>
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-full rounded-md" />
                </div>
              ))}
              <div className={cn("shrink-0 flex items-center gap-1.5", COLUMN_WIDTHS[3])}>
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-22 rounded-md" />
            <Skeleton className="h-8 w-17.5 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-18 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-14 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** The log card: tabs + search, then the table. */
export function ActivityLogCardSkeleton() {
  return (
    <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
      <ActivityToolbarSkeleton />
      <ActivityTableSkeleton />
    </div>
  );
}

export function ActivityPageSkeleton() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <PageTitle
        title="Activity Log"
        description="A plain-English history of what was created, changed, or deleted in the dashboard — and by whom"
      />
      <ActivityStatCardsSkeleton />
      <ActivityLogCardSkeleton />
    </div>
  );
}
