"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function VercelAnalytics() {
  return (
    <>
      <Analytics
        beforeSend={(event: BeforeSendEvent) => {
          // Exclude /dashboard and all nested subroutes (/dashboard/*) from Vercel Web Analytics
          try {
            const url = new URL(event.url, "http://localhost");
            if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) {
              return null;
            }
          } catch {
            if (event.url.includes("/dashboard")) {
              return null;
            }
          }
          return event;
        }}
      />
      <SpeedInsights
        beforeSend={(data) => {
          // Exclude /dashboard and all nested subroutes (/dashboard/*) from Speed Insights
          try {
            const url = new URL(data.url, "http://localhost");
            if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) {
              return null;
            }
          } catch {
            if (data.url.includes("/dashboard")) {
              return null;
            }
          }
          return data;
        }}
      />
    </>
  );
}
