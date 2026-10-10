import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { appendOrdersToSheet, type SheetOrderRow } from "@/lib/google-sheets";
import { replaceProductsSheet, type ProductSheetRow } from "@/lib/google-sheets-products";
import { db } from "@/db";
import { orders, products, categories } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSetting } from "@/lib/settings/read";
import { isAllowed } from "@/lib/permissions";
import { setActivityMeta, summarizeNames } from "@/features/activity/server/log-activity";

function formatOrderChannel(saleType: string | null | undefined, reference: string | null | undefined, storeName: string): string {
  if (saleType === "POS") {
    const ref = reference?.trim();
    if (!ref) return `${storeName} (POS)`;
    if (ref.toLowerCase().endsWith("(pos)")) return ref;
    return `${ref} (POS)`;
  }
  return "Website";
}

function toSheetRow(
  order: NonNullable<Awaited<ReturnType<typeof loadOrderForSheet>>>,
  storeName: string,
): SheetOrderRow {
  const address = [
    order.shippingAddress,
    order.shippingCity,
    order.shippingState,
    order.shippingPostalCode,
    order.shippingCountry,
  ]
    .filter(Boolean)
    .join(", ");

  const quantity = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const boughtCost = order.items.reduce(
    (sum, i) => sum + (i.costPrice ?? 0) * i.quantity,
    0,
  );

  return {
    date: order.createdAt.toISOString().slice(0, 10),
    orderNumber: order.orderNumber,
    customerName: order.user?.name ?? order.guestName ?? "Guest",
    phone: order.user?.phone ?? order.guestPhone ?? "",
    address,
    quantity,
    totalAmount: order.totalAmount,
    boughtCost,
    shippingCost: order.shippingCost != null ? Number(order.shippingCost) : 200,
    channel: formatOrderChannel(order.saleType, order.reference, storeName),
  };
}

function loadOrderForSheet(id: string) {
  return db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      user: true,
      items: { with: { product: true } },
    },
  });
}

const app = new Hono()

  .post(
    "/book",
    sessionMiddleware,
    zValidator("json", z.object({ orderId: z.string() })),
    async (c) => {
      const user = c.get("user");
      if (!isAllowed(user, "orders", "write", ["MODERATOR"])) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { orderId } = c.req.valid("json");
      const order = await loadOrderForSheet(orderId);
      if (!order) return c.json({ error: "Order not found" }, 404);

      try {
        const storeName = await getSetting("site_name");
        await appendOrdersToSheet([toSheetRow(order, storeName)]);
        await db.update(orders)
          .set({ sheetBookedAt: new Date() })
          .where(eq(orders.id, orderId));

        setActivityMeta(c, { name: `#${order.orderNumber}` });
        return c.json({ success: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to book to Google Sheet";
        console.error("Google Sheets book error:", err);
        return c.json({ error: msg }, 500);
      }
    }
  )

  .post(
    "/bulk-book",
    sessionMiddleware,
    zValidator("json", z.object({ orderIds: z.array(z.string()).min(1).max(200) })),
    async (c) => {
      const user = c.get("user");
      if (!isAllowed(user, "orders", "write", ["MODERATOR"])) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { orderIds } = c.req.valid("json");

      const targetOrders = await db.query.orders.findMany({
        where: inArray(orders.id, orderIds),
        with: {
          user: true,
          items: { with: { product: true } },
        },
      });

      if (targetOrders.length === 0) {
        return c.json({ error: "No orders found" }, 404);
      }

      try {
        const storeName = await getSetting("site_name");
        await appendOrdersToSheet(targetOrders.map((o) => toSheetRow(o, storeName)));
        await db.update(orders)
          .set({ sheetBookedAt: new Date() })
          .where(inArray(orders.id, targetOrders.map((o) => o.id)));

        setActivityMeta(c, {
          name: `${targetOrders.length} orders: ${summarizeNames(targetOrders.map((o) => `#${o.orderNumber}`))}`,
        });
        return c.json({ success: true, booked: targetOrders.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to book to Google Sheet";
        console.error("Google Sheets bulk book error:", err);
        return c.json({ error: msg }, 500);
      }
    }
  )

  .post(
    "/sync-products",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        categories: z.array(z.string()).optional(),
        products: z
          .array(
            z.object({
              name: z.string(),
              category: z.string(),
              price: z.number(),
              isAvailable: z.boolean(),
              imageUrl: z.string(),
            })
          )
          .optional(),
        clear: z.boolean().optional().default(true),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!isAllowed(user, "products", "write", ["MODERATOR"])) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { categories: categoryLabels, products: incomingProducts, clear } =
        c.req.valid("json");

      try {
        let rows: ProductSheetRow[] = [];

        if (incomingProducts && incomingProducts.length > 0) {
          rows = incomingProducts;
        } else if (categoryLabels && categoryLabels.length > 0) {
          const matchedCategories = await db.query.categories.findMany({
            where: inArray(categories.label, categoryLabels),
          });
          const categoryIds = matchedCategories.map((cat) => cat.id);

          const productsList = categoryIds.length
            ? await db.query.products.findMany({
                where: inArray(products.categoryId, categoryIds),
                with: { category: true },
              })
            : [];

          rows = productsList.flatMap((product) =>
            (product.images || []).map((imageUrl) => ({
              name: product.name,
              category: product.category?.label ?? "Uncategorized",
              price: product.price,
              isAvailable: product.stock > 0,
              imageUrl,
            }))
          );
        }

        // Send directly to n8n Product Cache Sync Webhook
        const webhookUrl =
          process.env.N8N_PRODUCT_CACHE_WEBHOOK_URL ||
          "https://n8n.sleepsheetbd.com/webhook/product-cache-sync";

        const n8nRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clear: clear ?? true, products: rows }),
        });

        if (!n8nRes.ok) {
          throw new Error(`n8n webhook responded with status ${n8nRes.status}`);
        }

        // Optional non-blocking background update for Google Sheets (if configured and clear is true)
        if (clear && rows.length > 0) {
          replaceProductsSheet(rows).catch((err) => {
            console.warn("Background Google Sheets sync warning (non-fatal):", err);
          });
        }

        if (categoryLabels && categoryLabels.length > 0) {
          setActivityMeta(c, {
            name: `${categoryLabels.length} categor${categoryLabels.length === 1 ? "y" : "ies"}: ${summarizeNames(categoryLabels)}`,
          });
        }
        return c.json({ success: true, count: rows.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to sync products to n8n";
        console.error("Product sync error:", err);
        return c.json({ error: msg }, 500);
      }
    }
  );

export default app;
