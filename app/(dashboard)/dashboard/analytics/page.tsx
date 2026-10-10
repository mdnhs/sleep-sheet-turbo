import type { Metadata } from "next";
import AnalyticsClient from "./analytics-client";

export const metadata: Metadata = {
  title: "Analytics | Sleep Sheet Admin",
  description: "Google Analytics 4 E-Commerce Funnel & Sales Planning Intelligence",
};

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
