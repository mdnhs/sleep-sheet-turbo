import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

// No standalone "list reviews" tool — reviews are returned embedded in
// get_product (each product's `reviews` array). Use that to find a review's
// id, then moderate here.
export function registerReviewTools(server: McpServer) {
  server.registerTool(
    "delete_review",
    {
      title: "Delete a review",
      description: "Permanently remove a product review (e.g. spam or abuse). Find the review id via get_product first.",
      inputSchema: { reviewId: z.string() },
    },
    async ({ reviewId }) => {
      const data = await api.delete(`/reviews/${encodeURIComponent(reviewId)}`);
      return text(data);
    }
  );
}
