import { Hono } from "hono";
import { db } from "@/db";
import { blockedIps, orders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { can } from "@/lib/permissions";
import { setActivityMeta } from "@/features/activity/server/log-activity";

/** Same shape the checkout route reads the client IP in. */
const ipSchema = z.string().trim().min(3).max(64);

const app = new Hono()

// List every blocked IP. The dashboard uses this to decide whether an order's
// action menu shows "Block Customer IP" or "Unblock Customer IP".
.get("/", sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !can(user, "orders", "read")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const rows = await db
      .select({
        id: blockedIps.id,
        ipAddress: blockedIps.ipAddress,
        reason: blockedIps.reason,
        orderId: blockedIps.orderId,
        orderNumber: orders.orderNumber,
        createdAt: blockedIps.createdAt,
      })
      .from(blockedIps)
      .leftJoin(orders, eq(blockedIps.orderId, orders.id))
      .orderBy(desc(blockedIps.createdAt));

    return c.json({ blockedIps: rows });
  } catch (error) {
    console.error("Failed to fetch blocked IPs:", error);
    return c.json({ error: "Failed to fetch blocked IPs" }, 500);
  }
})

// Block an IP. Idempotent: re-blocking an already-blocked IP updates the
// reason/order context instead of failing on the unique index.
.post(
  "/",
  sessionMiddleware,
  zValidator("json", z.object({
    ipAddress: ipSchema,
    reason: z.string().trim().max(500).optional(),
    orderId: z.string().optional(),
  })),
  async (c) => {
    const user = c.get("user");
    if (!user || !can(user, "orders", "block_ip")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { ipAddress, reason, orderId } = c.req.valid("json");

    try {
      const [row] = await db
        .insert(blockedIps)
        .values({
          ipAddress,
          reason: reason || null,
          orderId: orderId || null,
          blockedById: user.id,
        })
        .onConflictDoUpdate({
          target: blockedIps.ipAddress,
          set: { reason: reason || null, orderId: orderId || null, blockedById: user.id },
        })
        .returning();

      setActivityMeta(c, {
        name: ipAddress,
        changes: [{ label: "Blocked", to: reason || "Fake orders" }],
      });

      return c.json({ blockedIp: row });
    } catch (error) {
      console.error("Failed to block IP:", error);
      return c.json({ error: "Failed to block IP" }, 500);
    }
  }
)

// Unblock. The IP itself is the identifier — the dashboard never needs the row id.
.delete(
  "/:ip",
  sessionMiddleware,
  async (c) => {
    const user = c.get("user");
    if (!user || !can(user, "orders", "block_ip")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const ip = decodeURIComponent(c.req.param("ip"));

    try {
      await db.delete(blockedIps).where(eq(blockedIps.ipAddress, ip));
      setActivityMeta(c, { name: ip });
      return c.json({ success: true });
    } catch (error) {
      console.error("Failed to unblock IP:", error);
      return c.json({ error: "Failed to unblock IP" }, 500);
    }
  }
);

export default app;
