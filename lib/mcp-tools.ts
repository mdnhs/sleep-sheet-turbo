import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface McpToolContext {
  /** This deployment's own origin, e.g. https://yourstore.com */
  origin: string;
  /** The same bearer token (API key or OAuth access token) the caller used
   * to reach /api/mcp — forwarded as-is to internal API calls, since
   * session-middleware already accepts both formats. No separate internal
   * credential needed. */
  bearerToken: string;
}

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"] as const;

/** Builds the multipart body the upload routes expect (field "image") from
 * base64 input. The route itself re-validates type and size. */
function imageFormData(input: string, mimeType?: string, filename?: string): FormData {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(input.trim());
  const type = mimeType ?? match?.[1] ?? "image/jpeg";
  const bytes = Buffer.from(match ? match[2] : input.trim(), "base64");
  if (bytes.length === 0) throw new Error("Image data is empty or not valid base64");
  const ext = type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1];
  const form = new FormData();
  form.append("image", new Blob([bytes], { type }), filename ?? `image.${ext}`);
  return form;
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** Same role as mcp-server/src/api-client.ts, adapted for the embedded
 * (Connector) path: it calls this same deployment's own /api routes rather
 * than a separately-configured URL. */
function makeApiClient({ origin, bearerToken }: McpToolContext) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${origin}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // This is a self-call into the same deployment's own API, so it
      // shouldn't normally be slow — but with no timeout an MCP tool call
      // could hang the whole request indefinitely if that inner route ever
      // stalls (e.g. one of the external calls it in turn makes, like
      // Steadfast, hangs without its own timeout).
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (data as { error?: string; message?: string })?.error ||
        (data as { error?: string; message?: string })?.message ||
        `Request failed with status ${res.status}`;
      throw new Error(message);
    }
    return data as T;
  }

  // Multipart variant for the upload routes, which read `formData()` rather
  // than JSON. No Content-Type header: fetch sets the multipart boundary.
  async function upload<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`${origin}/api${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearerToken}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (data as { error?: string; message?: string })?.error ||
        (data as { error?: string; message?: string })?.message ||
        `Upload failed with status ${res.status}`;
      throw new Error(message);
    }
    return data as T;
  }

  return {
    upload,
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}

/**
 * Registers the same tool set as the local mcp-server package (see
 * mcp-server/src/tools/*.ts) but wired to call this deployment's own API
 * in-process rather than a separately-configured URL — used by the remote
 * /api/mcp Connector endpoint. Keep the two in sync if you add a tool to one.
 */
export function registerMcpTools(server: McpServer, ctx: McpToolContext) {
  const api = makeApiClient(ctx);

  // --- Blog ---
  server.registerTool(
    "list_blog_posts",
    {
      title: "List blog posts",
      description: "List blog posts on the store, newest first. Optionally filter by search text.",
      inputSchema: { search: z.string().optional(), page: z.number().int().min(1).optional() },
    },
    async ({ search, page }) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (page) params.set("page", String(page));
      return text(await api.get(`/blog?${params.toString()}`));
    }
  );

  server.registerTool(
    "get_blog_post",
    {
      title: "Get a blog post",
      description: "Fetch one blog post by its slug (or id).",
      inputSchema: { slug: z.string() },
    },
    async ({ slug }) => text(await api.get(`/blog/${encodeURIComponent(slug)}`))
  );

  server.registerTool(
    "create_blog_post",
    {
      title: "Create a blog post",
      description:
        "Create a new blog post. `slug` must be unique and URL-safe (lowercase, hyphens). Set isPublished:true to publish immediately, or false to save as a draft.",
      inputSchema: {
        title: z.string().min(1),
        slug: z.string().min(1),
        summary: z.string().optional(),
        content: z.string().min(1),
        coverImage: z.string().url().optional(),
        isPublished: z.boolean().default(false),
      },
    },
    async (input) => text(await api.post("/blog", input))
  );

  server.registerTool(
    "update_blog_post",
    {
      title: "Update a blog post",
      description:
        "Replace an existing blog post's content by id. All fields are required (mirrors the site's edit form) — use get_blog_post first if you only want to change one field.",
      inputSchema: {
        id: z.string(),
        title: z.string().min(1),
        slug: z.string().min(1),
        summary: z.string().optional(),
        content: z.string().min(1),
        coverImage: z.string().url().optional(),
        isPublished: z.boolean(),
      },
    },
    async ({ id, ...body }) => text(await api.put(`/blog/${id}`, body))
  );

  server.registerTool(
    "set_blog_post_published",
    {
      title: "Publish or unpublish a blog post",
      description: "Toggle a blog post's published status without touching its content.",
      inputSchema: { id: z.string(), isPublished: z.boolean() },
    },
    async ({ id, isPublished }) => text(await api.patch(`/blog/${id}/publish`, { isPublished }))
  );

  server.registerTool(
    "upload_blog_image",
    {
      title: "Upload a blog image",
      description:
        "Upload an image to the store's Cloudinary (blog folder) and get back its hosted URL — use it as a blog post's coverImage or inside post content. Pass the file as base64 (a data: URL is fine). JPEG/PNG/WebP/AVIF/GIF, max 5MB. Requires blog write permission.",
      inputSchema: {
        imageBase64: z.string().min(1).describe("Base64 file contents, or a data:image/...;base64, URL"),
        mimeType: z.enum(IMAGE_MIME_TYPES).optional().describe("Defaults to the data: URL's type, else image/jpeg"),
        filename: z.string().optional(),
      },
    },
    async ({ imageBase64, mimeType, filename }) => {
      const form = imageFormData(imageBase64, mimeType, filename);
      return text(await api.upload("/blog/upload-image", form));
    }
  );

  // --- Products (no create/delete — see mcp-server/src/tools/products.ts for why) ---
  server.registerTool(
    "list_products",
    {
      title: "List products",
      description: "List products in the storefront catalog. Supports search and category filtering.",
      inputSchema: {
        search: z.string().optional(),
        category: z.string().optional(),
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
      return text(await api.get(`/products?${params.toString()}`));
    }
  );

  server.registerTool(
    "get_product",
    {
      title: "Get a product",
      description: "Fetch full details for one product by its id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => text(await api.get(`/products/${encodeURIComponent(id)}`))
  );

  server.registerTool(
    "update_product_details",
    {
      title: "Update a product",
      description:
        "Update any product field: name, description, price, stock, discount, featured flag, SKU, category, variants, add-ons, tags, sizes, features, care instruction, images, specifications, default variant, or lowest-price display. Only the fields you pass are changed. `images` replaces the full image list — pass existing URLs (from get_product) plus/minus the ones you want to change; new file uploads aren't supported here. `specifications` replaces the full key/value list. `category` is the category's value/slug, not its id.",
      inputSchema: {
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.number().min(0).optional(),
        stock: z.number().int().min(0).optional(),
        discount: z.number().min(0).max(100).optional(),
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
    async ({ id, ...body }) => text(await api.patch(`/product/${id}/details`, body))
  );

  // --- Orders (no refund/delete — see mcp-server/src/tools/orders.ts for why) ---
  server.registerTool(
    "list_orders",
    {
      title: "List orders",
      description: "List orders, newest first. Optionally search by order number or customer, or filter by date range. Pass limit (and offset to page) unless you genuinely need every match — the response carries each order's full items, customer and payment details, and `total` reports how many matched.",
      inputSchema: {
        search: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async ({ search, from, to, limit, offset }) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (limit !== undefined) params.set("limit", String(limit));
      if (offset !== undefined) params.set("offset", String(offset));
      return text(await api.get(`/orders?${params.toString()}`));
    }
  );

  server.registerTool(
    "get_order",
    {
      title: "Get an order",
      description: "Fetch full details for one order by its id, including items, customer, and payment info.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => text(await api.get(`/orders/${encodeURIComponent(id)}`))
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
    async ({ id, ...body }) => text(await api.patch(`/orders/${id}`, body))
  );

  server.registerTool(
    "cancel_order",
    {
      title: "Cancel an order",
      description: "Cancel an order. By default restocks the ordered items — pass restock:false to skip that.",
      inputSchema: { id: z.string(), reason: z.string().max(500).optional(), restock: z.boolean().default(true) },
    },
    async ({ id, ...body }) => text(await api.post(`/orders/${id}/cancel`, body))
  );

  // --- Categories (read-only — structural, product FK target) ---
  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description:
        "List every product category, with each one's value/slug (the identifier update_product_details expects), label, parent, and product count.",
      inputSchema: {},
    },
    async () => text(await api.get(`/categories`))
  );

  // --- Customers (read-only) ---
  server.registerTool(
    "list_customers",
    {
      title: "List customers",
      description:
        "List storefront customers (plain USER accounts, not staff) with order count, lifetime spend, and last order date. Returns everyone — filter client-side by name/phone/email if you're looking for one person.",
      inputSchema: {},
    },
    async () => text(await api.get(`/users/customers`))
  );

  // --- Reports (read-only) ---
  server.registerTool(
    "get_financial_report",
    {
      title: "Get financial report",
      description:
        "Revenue, product cost, shipping, expenses, and profit for a date range (default: all time), plus cancelled/returned order totals. Cancelled and refunded orders are excluded from revenue.",
      inputSchema: { from: z.string().optional(), to: z.string().optional() },
    },
    async ({ from, to }) => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return text(await api.get(`/reports?${params.toString()}`));
    }
  );

  server.registerTool(
    "get_monthly_report",
    {
      title: "Get monthly financial breakdown",
      description: "Revenue, cost, shipping, expenses, and profit bucketed by month for a date range (default: all time).",
      inputSchema: { from: z.string().optional(), to: z.string().optional() },
    },
    async ({ from, to }) => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return text(await api.get(`/reports/monthly?${params.toString()}`));
    }
  );

  // --- Analytics (read-only) ---
  server.registerTool(
    "get_sales_overview",
    {
      title: "Get sales overview",
      description:
        "Revenue, order count, and trend vs. the previous equivalent period, for a preset period (default: month) or an explicit from/to range.",
      inputSchema: {
        period: z.enum(["today", "week", "month", "quarter", "year"]).optional().describe("Ignored if from/to are given"),
        from: z.string().optional().describe("Overrides period"),
        to: z.string().optional(),
      },
    },
    async ({ period, from, to }) => {
      const params = new URLSearchParams();
      if (period) params.set("period", period);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return text(await api.get(`/analytics/sales-overview?${params.toString()}`));
    }
  );

  server.registerTool(
    "get_top_products",
    {
      title: "Get top-selling products",
      description: "The 5 best-selling products by units sold (all time, cancelled orders excluded).",
      inputSchema: {},
    },
    async () => text(await api.get(`/analytics/most-purchased`))
  );

  // --- POS ---
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
        reference: z.string().optional().describe('e.g. "Facebook DM", "WhatsApp", a referring name'),
        note: z.string().optional(),
        shippingType: z.enum(["showroom", "online"]).default("online"),
        paymentMethod: z.enum(["COD", "CARD", "DUE"]).default("COD"),
        shippingCost: z.number().min(0).optional(),
        items: z.array(z.object({
          productId: z.string(),
          quantity: z.number().int().min(1),
          price: z.number().min(0).describe("Unit price actually charged"),
          costPrice: z.number().min(0).optional(),
          size: z.string().optional(),
          color: z.string().optional(),
        })).min(1),
      },
    },
    async (input) => text(await api.post(`/pos`, input))
  );

  // --- Steadfast courier (no cancel/unbook — dashboard-only) ---
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
    async (input) => text(await api.post(`/steadfast/book`, input))
  );

  server.registerTool(
    "track_shipment",
    {
      title: "Track a Steadfast shipment",
      description: "Get live delivery status for an order that's already been booked with Steadfast.",
      inputSchema: { orderId: z.string() },
    },
    async ({ orderId }) => text(await api.get(`/steadfast/track/${encodeURIComponent(orderId)}`))
  );

  // --- Most-wishlisted (analytics) ---
  server.registerTool(
    "get_most_wishlisted",
    {
      title: "Get most-wishlisted products",
      description: "The 5 products with the most wishlist adds — demand signal for items people want but haven't bought (restock/discount candidates).",
      inputSchema: {},
    },
    async () => text(await api.get(`/analytics/most-wishlisted`))
  );

  // --- Reviews (moderation) ---
  server.registerTool(
    "delete_review",
    {
      title: "Delete a review",
      description: "Permanently remove a product review (e.g. spam or abuse). Find the review id via get_product first — reviews come back embedded in each product's `reviews` array.",
      inputSchema: { reviewId: z.string() },
    },
    async ({ reviewId }) => text(await api.delete(`/reviews/${encodeURIComponent(reviewId)}`))
  );

  // --- Testimonials ---
  const testimonialRole = z.enum(["FASHION_ENTHUSIAST", "CUSTOMER", "INFLUENCER", "OTHER"]);

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
      return text(await api.get(`/testimonials?${params.toString()}`));
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
        role: testimonialRole.default("CUSTOMER"),
      },
    },
    async (input) => text(await api.post(`/testimonials`, input))
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
        role: testimonialRole.optional(),
      },
    },
    async ({ id, ...body }) => text(await api.patch(`/testimonials/${encodeURIComponent(id)}`, body))
  );

  server.registerTool(
    "delete_testimonial",
    {
      title: "Delete a testimonial",
      description: "Remove a testimonial from the homepage permanently.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => text(await api.delete(`/testimonials/${encodeURIComponent(id)}`))
  );

  // --- Expenses (no delete tool — corrections stay a dashboard action) ---
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
      return text(await api.get(`/expenses?${params.toString()}`));
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

  // --- Activity log (read-only) ---
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
      return text(await api.get(`/activity?${params.toString()}`));
    }
  );
}
