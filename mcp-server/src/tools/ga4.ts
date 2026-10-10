import { z } from "zod";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { text } from "../util.js";

const DEFAULT_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "546802046";

let analyticsClient: BetaAnalyticsDataClient | null = null;

function getGa4Client() {
  if (!analyticsClient) {
    analyticsClient = new BetaAnalyticsDataClient();
  }
  return analyticsClient;
}

export function registerGa4Tools(server: McpServer) {
  server.registerTool(
    "get_ga4_realtime_metrics",
    {
      title: "Get GA4 Realtime Active Users Metrics",
      description:
        "Fetch Google Analytics 4 (GA4) realtime metrics for active users, active page views, countries, and device categories in the last 30 minutes for Property ID 546802046.",
      inputSchema: {
        propertyId: z.string().optional().describe("GA4 Property ID (default: 546802046)"),
      },
    },
    async ({ propertyId }) => {
      try {
        const client = getGa4Client();
        const propId = propertyId || DEFAULT_PROPERTY_ID;

        const [response] = await client.runRealtimeReport({
          property: `properties/${propId}`,
          dimensions: [
            { name: "unifiedScreenName" },
            { name: "country" },
            { name: "deviceCategory" },
          ],
          metrics: [{ name: "activeUsers" }],
        });

        const rows = response.rows?.map((row) => ({
          page: row.dimensionValues?.[0]?.value || "unknown",
          country: row.dimensionValues?.[1]?.value || "unknown",
          device: row.dimensionValues?.[2]?.value || "unknown",
          activeUsers: Number(row.metricValues?.[0]?.value || 0),
        })) || [];

        const totalActiveUsers = rows.reduce((sum, r) => sum + r.activeUsers, 0);

        return text({
          propertyId: propId,
          totalActiveUsers,
          activeRealtimeBreakdown: rows.slice(0, 20),
        });
      } catch (err) {
        return text({
          error: "Failed to query GA4 Realtime API",
          details: err instanceof Error ? err.message : String(err),
          propertyId: propertyId || DEFAULT_PROPERTY_ID,
          note: "Ensure Google Cloud Service Account credentials (GOOGLE_APPLICATION_CREDENTIALS) are configured and granted Read Access on GA4 Property 546802046.",
        });
      }
    }
  );

  server.registerTool(
    "get_ga4_report",
    {
      title: "Get GA4 Analytics Report",
      description:
        "Run custom GA4 analytics metrics query (activeUsers, sessions, screenPageViews, totalRevenue, conversions) for property 546802046 over custom date ranges.",
      inputSchema: {
        startDate: z.string().default("7daysAgo").describe("e.g. 7daysAgo, 30daysAgo, 2026-07-01"),
        endDate: z.string().default("today").describe("e.g. today, 2026-07-24"),
        propertyId: z.string().optional().describe("GA4 Property ID (default: 546802046)"),
      },
    },
    async ({ startDate, endDate, propertyId }) => {
      try {
        const client = getGa4Client();
        const propId = propertyId || DEFAULT_PROPERTY_ID;

        const [response] = await client.runReport({
          property: `properties/${propId}`,
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "conversions" },
            { name: "totalRevenue" },
          ],
          dimensions: [{ name: "date" }],
        });

        const reportData = response.rows?.map((row) => ({
          date: row.dimensionValues?.[0]?.value,
          activeUsers: Number(row.metricValues?.[0]?.value || 0),
          sessions: Number(row.metricValues?.[1]?.value || 0),
          pageViews: Number(row.metricValues?.[2]?.value || 0),
          conversions: Number(row.metricValues?.[3]?.value || 0),
          revenue: Number(row.metricValues?.[4]?.value || 0),
        })) || [];

        return text({
          propertyId: propId,
          dateRange: { startDate, endDate },
          dailyBreakdown: reportData,
        });
      } catch (err) {
        return text({
          error: "Failed to query GA4 Report API",
          details: err instanceof Error ? err.message : String(err),
          propertyId: propertyId || DEFAULT_PROPERTY_ID,
        });
      }
    }
  );

  server.registerTool(
    "get_ga4_traffic_sources",
    {
      title: "Get GA4 Traffic Acquisition Sources",
      description:
        "Fetch GA4 traffic acquisition breakdown by channel, source, and campaign for property 546802046.",
      inputSchema: {
        startDate: z.string().default("30daysAgo"),
        endDate: z.string().default("today"),
        propertyId: z.string().optional(),
      },
    },
    async ({ startDate, endDate, propertyId }) => {
      try {
        const client = getGa4Client();
        const propId = propertyId || DEFAULT_PROPERTY_ID;

        const [response] = await client.runReport({
          property: `properties/${propId}`,
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
          metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        });

        const channels = response.rows?.map((row) => ({
          source: row.dimensionValues?.[0]?.value || "direct",
          medium: row.dimensionValues?.[1]?.value || "none",
          activeUsers: Number(row.metricValues?.[0]?.value || 0),
          sessions: Number(row.metricValues?.[1]?.value || 0),
        })) || [];

        return text({
          propertyId: propId,
          trafficSources: channels,
        });
      } catch (err) {
        return text({
          error: "Failed to query GA4 Traffic Sources",
          details: err instanceof Error ? err.message : String(err),
          propertyId: propertyId || DEFAULT_PROPERTY_ID,
        });
      }
    }
  );
}
