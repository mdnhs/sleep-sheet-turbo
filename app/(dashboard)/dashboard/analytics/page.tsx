import React from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { WebAnalyticsDashboard } from "@/features/web-analytics/components/web-analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics | Sleep Sheet Admin",
  description: "Website visitors, sources, funnel and orders",
};

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* nuqs reads the URL (useSearchParams), which needs a Suspense boundary. */}
      <React.Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <WebAnalyticsDashboard />
      </React.Suspense>
    </div>
  );
}
