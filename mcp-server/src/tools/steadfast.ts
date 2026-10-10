import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

// Booking creates a real courier consignment (external, costs money to
// reverse) — no cancel/unbook tool here, that stays a dashboard action.
export function registerSteadfastTools(server: McpServer) {
  server.registerTool(
    "book_shipment",
    {
      title: "Book a Steadfast courier shipment",
      description:
        "Book an order for delivery with Steadfast Courier. Sets the order's tracking number and moves it to PROCESSING. Use get_order first to confirm the order exists and isn't already booked.",
      inputSchema: {
        orderId: z.string(),
        recipient_phone: z.string().length(11).describe("11-digit BD phone number"),
        note: z.string().optional(),
      },
    },
    async (input) => {
      const data = await api.post(`/steadfast/book`, input);
      return text(data);
    }
  );

  server.registerTool(
    "track_shipment",
    {
      title: "Track a Steadfast shipment",
      description: "Get live delivery status for an order that's already been booked with Steadfast.",
      inputSchema: { orderId: z.string() },
    },
    async ({ orderId }) => {
      const data = await api.get(`/steadfast/track/${encodeURIComponent(orderId)}`);
      return text(data);
    }
  );
}
