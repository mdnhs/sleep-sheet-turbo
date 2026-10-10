import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

export function registerActivityTools(server: McpServer) {
  server.registerTool(
    "list_activity_log",
    {
      title: "List dashboard activity log",
      description:
        "List the audit trail of dashboard actions (who changed what, when). Search matches user name/email, action, target, path, or IP. Pass status:\"error\" to see only failed requests (status >= 400).",
      inputSchema: {
        search: z.string().optional(),
        status: z.enum(["error"]).optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ search, status, page, limit }) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));
      const data = await api.get(`/activity?${params.toString()}`);
      return text(data);
    }
  );
}
