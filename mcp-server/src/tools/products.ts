import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api } from "../api-client.js";
import { text } from "../util.js";

// Deliberately no create/delete tools here — an agent editing an existing
// listing's fields is a reasonably safe operational task; creating or
// deleting catalog entries has a much bigger blast radius (new image
// uploads, cascading deletes of reviews/cart items) and stays a
// dashboard-only action for now.
export function registerProductTools(server: McpServer) {
  server.registerTool(
    "list_products",
    {
      title: "List products",
      description: "List products in the storefront catalog. Supports search and category filtering.",
      inputSchema: {
        search: z.string().optional(),
        category: z.string().optional().describe("Category value/slug, comma-separated for multiple"),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ search, category, page, limit }) => {
      const params = new URLSearchParams({ admin: "true" });
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));
      const data = await api.get(`/products?${params.toString()}`);
      return text(data);
    }
  );

  server.registerTool(
    "get_product",
    {
      title: "Get a product",
      description: "Fetch full details for one product by its id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const data = await api.get(`/products/${encodeURIComponent(id)}`);
      return text(data);
    }
  );

  server.registerTool(
    "update_product_details",
    {
      title: "Update a product",
      description:
        "Update any product field: name, description, price, stock, discount, featured flag, SKU, category, variants, add-ons, tags, sizes, features, care instruction, images, specifications, default variant, or lowest-price display. Only the fields you pass are changed. `images` and `specifications` are full replacement lists — use get_product first to see current values and merge. `category` is the category's value/slug, not its id. New image file uploads aren't supported here (dashboard-only); pass existing URLs.",
      inputSchema: {
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.number().min(0).optional(),
        stock: z.number().int().min(0).optional(),
        discount: z.number().min(0).max(100).optional().describe("Percent off, 0-100"),
        isFeatured: z.boolean().optional(),
        sku: z.string().min(1).optional(),
        category: z.string().min(1).optional().describe("Category value/slug"),
        variants: z.array(z.object({ name: z.string(), price: z.number().nullable() })).optional(),
        addOns: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
        tags: z.array(z.string()).optional(),
        sizes: z.array(z.string()).optional(),
        features: z.array(z.string()).optional(),
        careInstruction: z.string().nullable().optional(),
        images: z.array(z.string().url()).optional().describe("Full replacement list of image URLs"),
        specifications: z.array(z.object({ key: z.string(), value: z.string() })).optional().describe("Full replacement list"),
        defaultVariantName: z.string().nullable().optional(),
        showLowestPriceAsDefault: z.boolean().optional(),
      },
    },
    async ({ id, ...body }) => {
      const data = await api.patch(`/product/${id}/details`, body);
      return text(data);
    }
  );
}
