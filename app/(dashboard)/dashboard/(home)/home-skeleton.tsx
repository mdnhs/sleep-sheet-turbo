"use client";

import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkeletonRows } from "@/hooks/use-skeleton-rows";
import { cn } from "@/lib/utils";

// Mirrors DashBoardClientPage (./client.tsx) block for block: POS button row,
// 8 KPI MetricCards, Recent Orders + Low Stock widgets, the Sales/Customers
// tabs (Sales tab open), Cohort + product rankings, then the 3 bottom metrics.

const PANEL = "rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex flex-col justify-between";

/** A table inside the widgets: same bordered box, slate header row and px-3 cells as the real <Table>s. */
function WidgetTableSkeleton({
  rows,
  cols,
  rowClassName,
  lead,
}: {
  rows: number;
  cols: number;
  rowClassName?: string;
  /** Size class of the product thumbnail in the first cell, if the table has one. */
  lead?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="flex h-9 items-center gap-4 bg-slate-50/70 dark:bg-muted/30 px-3">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className={cn("h-3 rounded-md", c === cols - 1 ? "ml-auto w-14" : "flex-1 max-w-20")} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className={cn("flex items-center gap-4 border-t border-slate-100 dark:border-slate-800 px-3", rowClassName)}
        >
          {Array.from({ length: cols }).map((_, c) =>
            c === 0 && lead ? (
              <div key={c} className="flex flex-1 items-center gap-2 min-w-0">
                <Skeleton className={cn("shrink-0 rounded-lg", lead)} />
                <Skeleton className="h-3.5 w-full max-w-40 rounded-md" />
              </div>
            ) : (
              <Skeleton
                key={c}
                className={cn("h-3.5 rounded-md", c === cols - 1 ? "ml-auto w-14" : "flex-1")}
              />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

export function MetricCardSkeleton({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="rounded-3xl bg-white dark:bg-card border-none p-4 sm:p-6 shadow-none flex flex-col justify-between min-h-[120px] sm:min-h-[136px]">
      <div className="flex items-center justify-between gap-1.5">
        <Skeleton className="h-3.5 w-24 rounded-md" />
        <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0" />
      </div>
      <div className="mt-2.5 mb-1">
        <Skeleton className="h-7 sm:h-8 w-24 sm:w-28 rounded-xl" />
      </div>
      {subtitle && <Skeleton className="h-3 w-3/4 rounded-md mt-0.5" />}
    </div>
  );
}

export function DashboardActionsSkeleton() {
  return (
    <div className="hidden sm:flex items-center justify-end gap-2">
      <Skeleton className="h-9 w-24 rounded-full" />
    </div>
  );
}

export function KeyMetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Each widget draws as many rows as it showed last time, up to its API limit.

/** Recent Orders table body: up to 5 orders, 6 columns (Order #, Customer, Channel, Date, Status, Total). */
export function RecentOrdersTableSkeleton() {
  const rows = useSkeletonRows("home.recent-orders", 5);
  return <WidgetTableSkeleton rows={rows} cols={6} rowClassName="h-11" />;
}

/** Low Stock table body: up to 10 products, 2 columns (Product, Stock Level). */
export function LowStockTableSkeleton() {
  const rows = useSkeletonRows("home.low-stock", 10);
  return <WidgetTableSkeleton rows={rows} cols={2} rowClassName="py-3" lead="w-7 h-7" />;
}

export type ProductRankListKey = "home.most-purchased" | "home.most-wishlisted";

/** Most Purchased / Most Wishlisted table body: top 5 products, 2 columns. */
export function ProductRankTableSkeleton({ listKey }: { listKey: ProductRankListKey }) {
  const rows = useSkeletonRows(listKey, 5);
  return <WidgetTableSkeleton rows={rows} cols={2} rowClassName="py-2.5" lead="w-8 h-8" />;
}

export function OperationalWidgetsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={PANEL}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-36 rounded-lg" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex-1">
          <RecentOrdersTableSkeleton />
        </div>
      </div>
      <div className={PANEL}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-md" />
            <Skeleton className="h-6 w-40 rounded-lg" />
          </div>
        </div>
        <div className="flex-1">
          <LowStockTableSkeleton />
        </div>
      </div>
    </div>
  );
}

/** Sales Overview / Customer Insights tabs, with the default Sales tab's two cards. */
export function OverviewTabsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-1 w-full md:w-[400px] mb-4 h-9 bg-white dark:bg-card rounded-full p-1">
        <Skeleton className="h-full rounded-full" />
        <Skeleton className="h-full rounded-full opacity-50" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        <div className={cn(PANEL, "col-span-1 lg:col-span-4")}>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-40 rounded-lg" />
            <Skeleton className="h-8 w-[140px] rounded-full" />
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
        <div className={cn(PANEL, "col-span-1 lg:col-span-3")}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Skeleton className="h-6 w-36 rounded-lg" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-56 max-w-full rounded-md mb-4 mt-1.5" />
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
          </div>
          <div className="flex-1 space-y-3 mt-1">
            <Skeleton className="h-full w-full min-h-[180px] rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductRankCardSkeleton({ listKey }: { listKey: ProductRankListKey }) {
  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-52 rounded-lg" />
      </div>
      <ProductRankTableSkeleton listKey={listKey} />
    </div>
  );
}

export function CohortAndRankingsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className={cn(PANEL, "h-full")}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-40 rounded-lg" />
        </div>
        <Skeleton className="h-80 flex-1 w-full rounded-2xl" />
      </div>
      <div className="space-y-6">
        <ProductRankCardSkeleton listKey="home.most-purchased" />
        <ProductRankCardSkeleton listKey="home.most-wishlisted" />
      </div>
    </div>
  );
}

export function BottomMetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <MetricCardSkeleton key={i} subtitle={false} />
      ))}
    </div>
  );
}

export function DashboardHomePageSkeleton() {
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageTitle title="Sales Overview" />
      <DashboardActionsSkeleton />
      <KeyMetricsSkeleton />
      <OperationalWidgetsSkeleton />
      <OverviewTabsSkeleton />
      <CohortAndRankingsSkeleton />
      <BottomMetricsSkeleton />
    </div>
  );
}
