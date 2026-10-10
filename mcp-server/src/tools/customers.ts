import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

// Read-only — no create/edit here; customer accounts are managed on the
// dashboard (password resets, role changes, etc. carry auth implications).
export function registerCustomerTools(server: McpServer) {
  server.registerTool(
    "list_customers",
    {
      title: "List customers",
      description:
        "List storefront customers (plain USER accounts, not staff) with order count, lifetime spend, and last order date. Returns everyone — filter client-side by name/phone/email if you're looking for one person.",
      inputSchema: {},
    },
    async () => {
      const data = await api.get(`/users/customers`);
      return text(data);
    }
  );
}
