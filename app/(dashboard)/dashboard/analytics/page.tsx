import type { Metadata } from "next";
import AnalyticsTabs from "./analytics-tabs";

export const metadata: Metadata = {
  title: "Analytics | Sleep Sheet Admin",
  description: "Website visitors, sources, funnel and orders, plus Google Analytics 4 links",
};

export default function AnalyticsPage() {
  return <AnalyticsTabs />;
}
