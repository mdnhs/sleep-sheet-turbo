import { PageTitle } from "@/components/dashboard-page-title";
import React from "react";
import type { Metadata } from "next";
import { WebAnalyticsDashboardSkeleton } from "./analytics-skeleton";
import { WebAnalyticsDashboard } from "@/features/web-analytics/components/web-analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Website visitors, sources, funnel and orders",
};

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageTitle title="Analytics" description="Website visitors, sources, funnel and orders" />
      {/* nuqs reads the URL (useSearchParams), which needs a Suspense boundary. */}
      <React.Suspense fallback={<WebAnalyticsDashboardSkeleton />}>
        <WebAnalyticsDashboard />
      </React.Suspense>
    </div>
  );
}
