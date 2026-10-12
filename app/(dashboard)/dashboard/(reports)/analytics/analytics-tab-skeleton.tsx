"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useSubTabs } from "@/hooks/use-sub-tabs";

/**
 * Picks the skeleton for the tab in `?tab=` (WebAnalyticsDashboard's nuqs
 * state, default "funnel"). Both variants are rendered on the server and
 * passed in, so only this choice runs on the client.
 */
export function AnalyticsTabSkeleton({ funnel, overview }: { funnel: ReactNode; overview: ReactNode }) {
  // Same fallback as the page: a tab the role doesn't open shows its first open one.
  const tab = useSubTabs("reports.analytics").pick(useSearchParams().get("tab") ?? "funnel");
  return tab === "overview" ? overview : funnel;
}
