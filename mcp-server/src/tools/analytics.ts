import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

export function registerAnalyticsTools(server: McpServer) {
  server.registerTool(
    "get_sales_overview",
    {
      title: "Get sales overview",
      description:
        "Revenue, order count, and trend vs. the previous equivalent period, for a preset period (default: month) or an explicit from/to range.",
      inputSchema: {
        period: z
          .enum(["today", "week", "month", "quarter", "year"])
          .optional()
          .describe("Preset range; ignored if from/to are given"),
        from: z.string().optional().describe("ISO date, inclusive — overrides period"),
        to: z.string().optional().describe("ISO date, inclusive"),
      },
    },
    async ({ period, from, to }) => {
      const params = new URLSearchParams();
      if (period) params.set("period", period);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await api.get(`/analytics/sales-overview?${params.toString()}`);
      return text(data);
    }
  );

  server.registerTool(
    "get_top_products",
    {
      title: "Get top-selling products",
      description: "The 5 best-selling products by units sold (all time, cancelled orders excluded).",
      inputSchema: {},
    },
    async () => {
      const data = await api.get(`/analytics/most-purchased`);
      return text(data);
    }
  );

  server.registerTool(
    "get_most_wishlisted",
    {
      title: "Get most-wishlisted products",
      description: "The 5 products with the most wishlist adds — demand signal for items people want but haven't bought (restock/discount candidates).",
      inputSchema: {},
    },
    async () => {
      const data = await api.get(`/analytics/most-wishlisted`);
      return text(data);
    }
  );
}
