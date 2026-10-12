"use client";

import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkeletonRows } from "@/hooks/use-skeleton-rows";
import { cn } from "@/lib/utils";

// Mirrors page.tsx (ReportsContent): a right-aligned pill filter row, 6 stat
// cards, the Page-wise Breakdown table card and the Month-wise Breakdown
// table card. The title lives in the navbar (<PageTitle>), not in the page.

const CARD = "rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4";
const TABLE_WRAP = "overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800";
const TABLE_HEAD = "flex h-12 items-center gap-4 bg-slate-50/70 dark:bg-muted/30 px-3";
const TABLE_ROW = "flex items-center gap-4 border-t border-slate-100 dark:border-slate-800/60 px-3";

// "All Time", "Today", "Last 7 Days", "This Month", "Last Month"
const FILTER_PILL_WIDTHS = ["w-18", "w-15", "w-23", "w-22", "w-22"];

export function ReportsFilterBarSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_PILL_WIDTHS.map((w, i) => (
          <Skeleton key={i} className={cn("h-8 rounded-full", w)} />
        ))}
        {/* DateRangePicker trigger */}
        <Skeleton className="h-9 w-35 rounded-4xl" />
      </div>
    </div>
  );
}

function ReportStatCardSkeleton() {
  return (
    <div className="rounded-3xl bg-white dark:bg-card border-none shadow-none p-4 sm:p-6 flex flex-col justify-between min-h-30 sm:min-h-34">
      <div className="flex items-center justify-between gap-1.5">
        <Skeleton className="h-3.5 sm:h-4 w-20 sm:w-24 rounded-md" />
        <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0" />
      </div>
      <div className="mt-2.5 mb-1 space-y-1.5">
        <Skeleton className="h-5 sm:h-7 lg:h-8 w-3/4 rounded-lg" />
        <Skeleton className="h-2.5 sm:h-3 w-full rounded-md" />
      </div>
    </div>
  );
}

export function ReportsStatCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <ReportStatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Page / Channel, Orders, Sales, Costs, Net Profit/Loss, Margin, Cancelled.
 * Not paged: rows are what it showed last time, capped at 3.
 */
export function PageWiseBreakdownSkeleton() {
  const rows = useSkeletonRows("reports.pages", 3);
  const cells = (
    <>
      <div className="flex flex-col items-center gap-1 flex-1">
        <Skeleton className="h-4 w-8 rounded-md" />
        <Skeleton className="h-2.5 w-10 rounded-md" />
      </div>
      <Skeleton className="h-4 flex-1 rounded-md" />
      <div className="flex flex-col items-end gap-1 flex-1">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-2.5 w-3/4 rounded-md" />
      </div>
      <Skeleton className="h-4 flex-1 rounded-md" />
      <div className="flex justify-center flex-1">
        <Skeleton className="h-5 w-10 rounded-full" />
      </div>
      <Skeleton className="h-4 flex-1 rounded-md" />
    </>
  );

  return (
    <div className={CARD}>
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-48 rounded-xl" />
        <Skeleton className="h-3.5 w-80 max-w-full rounded-md" />
      </div>
      <div className={TABLE_WRAP}>
        <div className="min-w-180">
          <div className={TABLE_HEAD}>
            <Skeleton className="h-4 w-50 shrink-0 rounded-md" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1 rounded-md" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className={cn(TABLE_ROW, "h-15")}>
              <div className="flex w-50 shrink-0 items-center gap-2.5">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-2.5 w-24 rounded-md" />
                </div>
              </div>
              {cells}
            </div>
          ))}
          {/* Total row */}
          <div className={cn(TABLE_ROW, "h-15 bg-slate-50 dark:bg-muted/30")}>
            <div className="w-50 shrink-0">
              <Skeleton className="h-4 w-12 rounded-md" />
            </div>
            {cells}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Month, Sales, Costs, Expenses, Net Profit/Loss (+ total row). Not paged:
 * rows are what it showed last time, capped at 6.
 */
export function MonthlyBreakdownSkeleton() {
  const rows = useSkeletonRows("reports.months", 6);
  return (
    <div className={CARD}>
      <Skeleton className="h-6 w-48 rounded-xl" />
      <div className={TABLE_WRAP}>
        <div className="min-w-140">
          <div className={TABLE_HEAD}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1 rounded-md" />
            ))}
          </div>
          {Array.from({ length: rows + 1 }).map((_, r) => (
            <div
              key={r}
              className={cn(TABLE_ROW, "h-11", r === rows && "bg-slate-50 dark:bg-muted/30")}
            >
              {Array.from({ length: 5 }).map((_, c) => (
                <Skeleton key={c} className={cn("h-4 flex-1 rounded-md", c === 0 && "max-w-28")} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Everything below the filter row; shown while the report query loads. */
export function ReportsDataSkeleton() {
  return (
    <div className="space-y-6">
      <ReportsStatCardsSkeleton />
      <PageWiseBreakdownSkeleton />
      <MonthlyBreakdownSkeleton />
    </div>
  );
}

export function ReportsPageSkeleton() {
  return (
    <div className="flex-col">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
        <PageTitle title="Reports & Profit/Loss" />
        <ReportsFilterBarSkeleton />
        <ReportsDataSkeleton />
      </div>
    </div>
  );
}
