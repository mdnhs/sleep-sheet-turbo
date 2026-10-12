import { Suspense } from "react";
import { PageTitle } from "@/components/dashboard-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  FunnelCardSkeleton,
  IncompleteCheckoutsSkeleton,
  OverviewTabSkeleton,
} from "@/features/web-analytics/components/wa-skeletons";
import { KpiCardsUrlSkeleton } from "@/features/web-analytics/components/kpi-cards-url-skeleton";
import { AnalyticsTabSkeleton } from "./analytics-tab-skeleton";

// Mirrors features/web-analytics/components/web-analytics-dashboard.tsx:
// Funnel/Overview TabsList, range presets + custom range + tracking toggle,
// then the tab in `?tab=` — the funnel tab (live badge, FunnelCard beside
// IncompleteCheckouts) or the overview tab (KPIs, trend, breakdowns,
// products). The title lives in the navbar (<PageTitle>).

type AnalyticsTab = "funnel" | "overview";

/** TabsList (default variant) with the Funnel / Overview triggers; `tab` is the active one. */
export function AnalyticsTabsSkeleton({ tab = "funnel" }: { tab?: AnalyticsTab }) {
  return (
    <div className="inline-flex w-fit h-9 items-center justify-center gap-1 rounded-4xl p-[3px] bg-muted">
      <div className={cn("flex h-[calc(100%-1px)] items-center rounded-xl px-2", tab === "funnel" && "bg-background")}>
        <Skeleton className="h-3.5 w-14 rounded-md" />
      </div>
      <div className={cn("flex h-[calc(100%-1px)] items-center rounded-xl px-2", tab === "overview" && "bg-background")}>
        <Skeleton className="h-3.5 w-16 rounded-md" />
      </div>
    </div>
  );
}

/** RANGE_PRESETS buttons (size sm), DateRangePicker, then TrackingToggle on the right. */
export function AnalyticsRangeBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {["w-16", "w-24", "w-24", "w-24"].map((w, i) => (
        <Skeleton key={i} className={cn("h-8 rounded-4xl", w)} />
      ))}
      <Skeleton className="h-9 w-35 rounded-4xl" />
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-14 rounded-md" />
          <Skeleton className="h-[18.4px] w-8 rounded-full" />
          <Skeleton className="h-3.5 w-6 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function LiveBadgeSkeleton() {
  return (
    <div className="flex justify-end">
      <div className="flex items-center gap-2 rounded-full border px-3 py-1">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-3.5 w-16 rounded-md" />
      </div>
    </div>
  );
}

/** The funnel tab: live badge, then FunnelCard beside IncompleteCheckouts. */
export function FunnelTabSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <LiveBadgeSkeleton />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <FunnelCardSkeleton />
        <IncompleteCheckoutsSkeleton />
      </div>
    </div>
  );
}

function DashboardSkeleton({ tab }: { tab: AnalyticsTab }) {
  return (
    <div className="flex flex-col gap-4">
      <AnalyticsTabsSkeleton tab={tab} />
      <AnalyticsRangeBarSkeleton />
      {tab === "overview" ? <OverviewTabSkeleton kpis={<KpiCardsUrlSkeleton />} /> : <FunnelTabSkeleton />}
    </div>
  );
}

/** <WebAnalyticsDashboard /> on the tab in the URL (the page's Suspense fallback). */
export function WebAnalyticsDashboardSkeleton() {
  const funnel = <DashboardSkeleton tab="funnel" />;
  return (
    // Reading the URL needs a Suspense boundary when prerendered; the default tab stands in.
    <Suspense fallback={funnel}>
      <AnalyticsTabSkeleton funnel={funnel} overview={<DashboardSkeleton tab="overview" />} />
    </Suspense>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageTitle title="Analytics" description="Website visitors, sources, funnel and orders" />
      <WebAnalyticsDashboardSkeleton />
    </div>
  );
}
