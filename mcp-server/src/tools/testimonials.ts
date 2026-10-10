import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

const roleEnum = z.enum(["FASHION_ENTHUSIAST", "CUSTOMER", "INFLUENCER", "OTHER"]);

export function registerTestimonialTools(server: McpServer) {
  server.registerTool(
    "list_testimonials",
    {
      title: "List testimonials",
      description: "List homepage testimonials, newest first. Optionally search by name or message text.",
      inputSchema: {
        search: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ search, page, limit }) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));
      const data = await api.get(`/testimonials?${params.toString()}`);
      return text(data);
    }
  );

  server.registerTool(
    "create_testimonial",
    {
      title: "Create a testimonial",
      description: "Add a new customer testimonial to the homepage. `image`/`screenshot` must be existing hosted URLs — this tool doesn't upload files.",
      inputSchema: {
        name: z.string().optional(),
        message: z.string().optional(),
        rating: z.number().int().min(1).max(5),
        image: z.string().url().optional(),
        screenshot: z.string().url().optional(),
        role: roleEnum.default("CUSTOMER"),
      },
    },
    async (input) => {
      const data = await api.post(`/testimonials`, input);
      return text(data);
    }
  );

  server.registerTool(
    "update_testimonial",
    {
      title: "Update a testimonial",
      description: "Edit an existing testimonial's text, rating, image, or role.",
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        message: z.string().optional(),
        rating: z.number().int().min(1).max(5).optional(),
        image: z.string().url().optional(),
        screenshot: z.string().url().optional(),
        role: roleEnum.optional(),
      },
    },
    async ({ id, ...body }) => {
      const data = await api.patch(`/testimonials/${encodeURIComponent(id)}`, body);
      return text(data);
    }
  );

  server.registerTool(
    "delete_testimonial",
    {
      title: "Delete a testimonial",
      description: "Remove a testimonial from the homepage permanently.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const data = await api.delete(`/testimonials/${encodeURIComponent(id)}`);
      return text(data);
    }
  );
}
