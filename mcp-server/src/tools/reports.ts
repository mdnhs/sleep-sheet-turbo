import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

// Read-only financial reporting — revenue/cost/profit come straight out of
// orders + expenses, no write path here.
export function registerReportTools(server: McpServer) {
  server.registerTool(
    "get_financial_report",
    {
      title: "Get financial report",
      description:
        "Revenue, product cost, shipping, expenses, and profit for a date range (default: all time), plus cancelled/returned order totals. Cancelled and refunded orders are excluded from revenue.",
      inputSchema: {
        from: z.string().optional().describe("ISO date, inclusive"),
        to: z.string().optional().describe("ISO date, inclusive"),
      },
    },
    async ({ from, to }) => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await api.get(`/reports?${params.toString()}`);
      return text(data);
    }
  );

  server.registerTool(
    "get_monthly_report",
    {
      title: "Get monthly financial breakdown",
      description: "Revenue, cost, shipping, expenses, and profit bucketed by month for a date range (default: all time).",
      inputSchema: {
        from: z.string().optional().describe("ISO date, inclusive"),
        to: z.string().optional().describe("ISO date, inclusive"),
      },
    },
    async ({ from, to }) => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await api.get(`/reports/monthly?${params.toString()}`);
      return text(data);
    }
  );
}
