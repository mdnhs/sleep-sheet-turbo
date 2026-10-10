import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

// No refund or delete tools — those touch money/inventory and cascade to
// other rows (timeline events, stock restocking); keep those dashboard-only.
export function registerOrderTools(server: McpServer) {
  server.registerTool(
    "list_orders",
    {
      title: "List orders",
      description: "List orders, newest first. Optionally search by order number or customer name/email, or filter by date range.",
      inputSchema: {
        search: z.string().optional(),
        from: z.string().optional().describe("ISO date, inclusive"),
        to: z.string().optional().describe("ISO date, inclusive"),
      },
    },
    async ({ search, from, to }) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await api.get(`/orders?${params.toString()}`);
      return text(data);
    }
  );

  server.registerTool(
    "get_order",
    {
      title: "Get an order",
      description: "Fetch full details for one order by its id, including items, customer, and payment info.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const data = await api.get(`/orders/${encodeURIComponent(id)}`);
      return text(data);
    }
  );

  server.registerTool(
    "update_order_status",
    {
      title: "Update an order's status",
      description: "Change an order's fulfilment and/or payment status. Writes a timeline entry automatically.",
      inputSchema: {
        id: z.string(),
        status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).optional(),
        paymentStatus: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]).optional(),
      },
    },
    async ({ id, ...body }) => {
      const data = await api.patch(`/orders/${id}`, body);
      return text(data);
    }
  );

  server.registerTool(
    "cancel_order",
    {
      title: "Cancel an order",
      description: "Cancel an order. By default restocks the ordered items — pass restock:false to skip that.",
      inputSchema: {
        id: z.string(),
        reason: z.string().max(500).optional(),
        restock: z.boolean().default(true),
      },
    },
    async ({ id, ...body }) => {
      const data = await api.post(`/orders/${id}/cancel`, body);
      return text(data);
    }
  );
}
