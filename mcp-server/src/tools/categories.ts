import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

// Read-only — categories are structural (products reference them by id),
// so creating/editing/deleting stays a dashboard-only action for now.
export function registerCategoryTools(server: McpServer) {
  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description:
        "List every product category, with each one's value/slug (the identifier update_product_details expects), label, parent, and product count.",
      inputSchema: {},
    },
    async () => {
      const data = await api.get(`/categories`);
      return text(data);
    }
  );
}
