"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/traffic-tracker";
import { useSettings } from "@/features/settings/api/use-settings";
import { setCollectorEnabled } from "@/features/web-analytics/lib/collector";

export function TrafficTracker() {
  const pathname = usePathname();
  const { data: settings } = useSettings();
  const analyticsSetting = settings?.analytics_enabled;
  // Last path actually reported. Starts empty so the first render reports the
  // landing page, and a single ref covers both the initial view and later
  // navigations — the old two-effect version double-fired the first page view
  // under React Strict Mode's dev double-invoke.
  const reportedPath = useRef<string | null>(null);

  useEffect(() => {
    setCollectorEnabled(analyticsSetting !== "false");
  }, [analyticsSetting]);

  useEffect(() => {
    if (reportedPath.current === pathname) return;
    reportedPath.current = pathname;
    trackEvent("page_view", pathname);
  }, [pathname]);

  return null;
}
