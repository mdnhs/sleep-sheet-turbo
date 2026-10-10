"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebAnalyticsDashboard } from "@/features/web-analytics/components/web-analytics-dashboard";
import AnalyticsClient from "./analytics-client";

export default function AnalyticsTabs() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Tabs defaultValue="website">
        <TabsList>
          <TabsTrigger value="website">Website</TabsTrigger>
          <TabsTrigger value="ga4">GA4</TabsTrigger>
        </TabsList>
        <TabsContent value="website" className="mt-4">
          {/* nuqs reads the URL (useSearchParams), which needs a Suspense boundary. */}
          <React.Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
            <WebAnalyticsDashboard />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="ga4" className="mt-4">
          <AnalyticsClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}
