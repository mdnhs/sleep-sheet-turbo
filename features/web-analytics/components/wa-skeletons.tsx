import type * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DraftsTableSkeleton } from "./drafts-table-skeleton";

// Loading blocks for the analytics cards (funnel and overview tabs). The
// analytics route skeleton
// (app/(dashboard)/dashboard/(reports)/analytics/analytics-skeleton.tsx)
// composes the full cards; each card renders its inner block while its query
// loads, so the route skeleton hands over to the real UI with no second
// placeholder in between.

export { DraftsTableSkeleton };

// shadcn Card (`ring-0`): rounded-2xl bg-card py-6, header/content px-6.
const CARD = "flex flex-col gap-6 overflow-hidden rounded-2xl bg-card py-6 text-sm";

/** FunnelCard content: 8 steps, each a label/count row, a bar and (after the first) a drop-off line. */
export function FunnelStepsSkeleton() {
  return (
    <div aria-hidden className="space-y-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-3.5 w-28 rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-20 rounded-md" />
          </div>
          <Skeleton className="mt-1.5 h-2 w-full rounded-full" />
          {i > 0 && (
            <div className="mt-1.5 flex justify-between gap-x-3">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** FunnelCard: title, then the steps. */
export function FunnelCardSkeleton() {
  return (
    <div className={CARD}>
      <div className="px-6">
        <Skeleton className="h-5 w-40 rounded-md" />
      </div>
      <div className="px-6">
        <FunnelStepsSkeleton />
      </div>
    </div>
  );
}

/** DraftStats: the three stat tiles above the leads tabs. */
export function DraftStatsSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-3 gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border px-3 py-2 space-y-1.5">
          <Skeleton className="h-3 w-16 rounded-md" />
          <Skeleton className="h-6 w-12 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** IncompleteCheckouts: DraftStats (3 tiles), line tabs (Incomplete / Completed) and the leads table. */
export function IncompleteCheckoutsSkeleton({ rows }: { rows?: number }) {
  return (
    <div className={cn(CARD, "self-stretch")}>
      <div className="flex flex-col gap-4 px-6">
        <DraftStatsSkeleton />
        <div className="inline-flex w-fit h-9 items-center gap-1 p-[3px]">
          <Skeleton className="h-3.5 w-24 rounded-md mx-2" />
          <Skeleton className="h-3.5 w-24 rounded-md mx-2" />
        </div>
        <DraftsTableSkeleton rows={rows} />
      </div>
    </div>
  );
}

/** KpiCards: one card's value (text-2xl) while the overview loads. */
export function KpiValueSkeleton() {
  return <Skeleton aria-hidden className="h-8 w-20" />;
}

/** KpiCards: six metric cards (icon + label, then the value); `active` is the selected metric's card. */
export function KpiCardsSkeleton({ active = 0 }: { active?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={cn("flex flex-col gap-1 overflow-hidden rounded-2xl p-4 text-sm", i === active ? "bg-primary/10" : "bg-card")}
        >
          <div className="flex h-4 items-center gap-1.5">
            <Skeleton className="size-3.5 rounded-sm" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
          <KpiValueSkeleton />
        </div>
      ))}
    </div>
  );
}

/** TrendChart content: the h-64 area chart. */
export function TrendAreaSkeleton() {
  return <Skeleton aria-hidden className="h-64 w-full" />;
}

/** TrendChart: metric title, then the chart. */
export function TrendChartSkeleton() {
  return (
    <div className={CARD}>
      <div className="px-6">
        <Skeleton className="h-5 w-28 rounded-md" />
      </div>
      <div className="px-6">
        <TrendAreaSkeleton />
      </div>
    </div>
  );
}

/** BreakdownPanel content: rows of icon + label and the visitors (plus orders / revenue) columns. */
export function BreakdownRowsSkeleton({ rows = 5, showOrders = false }: { rows?: number; showOrders?: boolean }) {
  return (
    <div aria-hidden className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-9 items-center justify-between gap-3 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className={cn("h-3.5 rounded-md", ["w-32", "w-24", "w-28", "w-20", "w-16"][i % 5])} />
          </div>
          <div className="flex shrink-0 gap-6">
            {showOrders && (
              <>
                <Skeleton className="h-3.5 w-10 rounded-md" />
                <Skeleton className="h-3.5 w-20 rounded-md" />
              </>
            )}
            <Skeleton className="h-3.5 w-12 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** BreakdownPanel: the dimension TabsList (or a plain label for one tab), column labels, then the rows. */
export function BreakdownPanelSkeleton({ tabs = 1, showOrders = false }: { tabs?: number; showOrders?: boolean }) {
  return (
    <div className={CARD}>
      <div className="px-6 pb-2">
        {tabs > 1 ? (
          <div className="inline-flex w-fit h-9 items-center gap-1 rounded-4xl p-[3px] bg-muted">
            {Array.from({ length: tabs }).map((_, i) => (
              <div key={i} className={cn("flex h-[calc(100%-1px)] items-center rounded-xl px-2", i === 0 && "bg-background")}>
                <Skeleton className="h-3.5 w-14 rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-20 rounded-md" />
          </div>
        )}
      </div>
      <div className="px-6">
        <div className="mb-2 flex h-4 items-center justify-between px-3">
          <Skeleton className="h-3 w-16 rounded-md" />
          <div className="flex gap-6">
            {showOrders && (
              <>
                <Skeleton className="h-3 w-10 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </>
            )}
            <Skeleton className="h-3 w-12 rounded-md" />
          </div>
        </div>
        <BreakdownRowsSkeleton showOrders={showOrders} />
      </div>
    </div>
  );
}

/** ProductsTable content: header row, then product (thumbnail + name) / views / add to cart / orders / view→order rows. */
export function ProductsTableRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="overflow-x-auto">
      <div className="min-w-120">
        <div className="flex h-12 items-center gap-4 border-b px-3">
          <Skeleton className="h-3.5 w-20 rounded-md" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-3.5 w-14 rounded-md", i === 0 && "ml-auto")} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 border-b p-3 last:border-0">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Skeleton className="size-8 shrink-0 rounded" />
              <Skeleton className="h-3.5 w-36 rounded-md" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 w-14 rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** ProductsTable: title, then the table. */
export function ProductsTableSkeleton() {
  return (
    <div className={CARD}>
      <div className="px-6">
        <Skeleton className="h-5 w-32 rounded-md" />
      </div>
      <div className="px-6">
        <ProductsTableRowsSkeleton />
      </div>
    </div>
  );
}

/** The overview tab: KPI cards, trend chart, the four breakdown panels, then the products table. */
/** `kpis` lets the page pass a URL-aware KpiCardsSkeleton (kpi-cards-url-skeleton.tsx). */
export function OverviewTabSkeleton({ kpis = <KpiCardsSkeleton /> }: { kpis?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {kpis}
      <TrendChartSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownPanelSkeleton tabs={3} />
        <BreakdownPanelSkeleton tabs={4} showOrders />
        <BreakdownPanelSkeleton />
        <BreakdownPanelSkeleton tabs={3} />
      </div>
      <ProductsTableSkeleton />
    </div>
  );
}
