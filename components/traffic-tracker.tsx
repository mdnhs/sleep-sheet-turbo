"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/traffic-tracker";

export function TrafficTracker() {
  const pathname = usePathname();
  // Last path actually reported. Starts empty so the first render reports the
  // landing page, and a single ref covers both the initial view and later
  // navigations — the old two-effect version double-fired the first page view
  // under React Strict Mode's dev double-invoke.
  const reportedPath = useRef<string | null>(null);

  useEffect(() => {
    if (reportedPath.current === pathname) return;
    reportedPath.current = pathname;
    trackEvent("page_view", pathname);
  }, [pathname]);

  return null;
}
