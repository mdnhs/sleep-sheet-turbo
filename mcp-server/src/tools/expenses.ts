import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

// No delete tool — removing an expense affects historical profit reports;
// keep corrections a dashboard action so they're deliberate.
export function registerExpenseTools(server: McpServer) {
  server.registerTool(
    "list_expense_categories",
    {
      title: "List expense categories",
      description: "List expense categories (e.g. Rent, Ads, Salaries). Use the id when adding an expense.",
      inputSchema: {},
    },
    async () => text(await api.get(`/expenses/categories`))
  );

  server.registerTool(
    "create_expense_category",
    {
      title: "Create an expense category",
      description: "Add a new expense category. Fails if a category with the same name (case-insensitive) already exists.",
      inputSchema: { name: z.string().min(1) },
    },
    async (input) => text(await api.post(`/expenses/categories`, input))
  );

  server.registerTool(
    "list_expenses",
    {
      title: "List expenses",
      description: "List recorded expenses (up to 500), newest first, with running total. Optionally filter by date range or category.",
      inputSchema: {
        from: z.string().optional().describe("ISO date, inclusive"),
        to: z.string().optional().describe("ISO date, inclusive"),
        categoryId: z.string().optional(),
      },
    },
    async ({ from, to, categoryId }) => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (categoryId) params.set("categoryId", categoryId);
      const data = await api.get(`/expenses?${params.toString()}`);
      return text(data);
    }
  );

  server.registerTool(
    "add_expense",
    {
      title: "Add an expense",
      description: "Record a new expense. Use list_expense_categories first to get a valid categoryId.",
      inputSchema: {
        amount: z.number().min(0.01),
        categoryId: z.string(),
        note: z.string().optional(),
        date: z.string().optional().describe("ISO date, defaults to now"),
      },
    },
    async (input) => text(await api.post(`/expenses`, input))
  );

  server.registerTool(
    "get_expense_summary",
    {
      title: "Get expense summary",
      description: "All-time and this-month expense totals, plus the top spending category this month.",
      inputSchema: {},
    },
    async () => text(await api.get(`/expenses/summary`))
  );
}
