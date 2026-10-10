import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

export function registerPosTools(server: McpServer) {
  server.registerTool(
    "create_pos_order",
    {
      title: "Create a POS (manual) order",
      description:
        "Record an in-person, phone, or WhatsApp sale as a POS order. Does not send a Meta Purchase event (POS sales aren't ad-attributed) and does not touch cart/checkout state. Use get_product first to confirm current price and productId.",
      inputSchema: {
        customerName: z.string().min(1),
        customerPhone: z.string().optional(),
        customerAddress: z.string().optional(),
        reference: z.string().optional().describe("e.g. \"Facebook DM\", \"WhatsApp\", a referring name"),
        note: z.string().optional(),
        shippingType: z.enum(["showroom", "online"]).default("online"),
        paymentMethod: z.enum(["COD", "CARD", "DUE"]).default("COD"),
        shippingCost: z.number().min(0).optional(),
        items: z
          .array(
            z.object({
              productId: z.string(),
              quantity: z.number().int().min(1),
              price: z.number().min(0).describe("Unit price actually charged"),
              costPrice: z.number().min(0).optional(),
              size: z.string().optional(),
              color: z.string().optional(),
            })
          )
          .min(1),
      },
    },
    async (input) => {
      const data = await api.post(`/pos`, input);
      return text(data);
    }
  );
}
