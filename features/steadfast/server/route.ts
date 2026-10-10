import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import {
  createSteadfastOrder,
  getSteadfastStatusByInvoice,
  getSteadfastBalance,
} from "@/lib/steadfast";
import { db } from "@/db";
import { orders, orderTimelineEvents, orderItems } from "@/db/schema";
import type { OrderStatus } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { isAllowed } from "@/lib/permissions";

// Once an order is in one of these, Steadfast will never move it again — see
// the switch below (nothing maps to REFUNDED, and DELIVERED/CANCELLED are
// dead ends) — so batch/poll callers skip them server-side too, as a backstop
// in case a caller sends a stale order list.
// Typed off the actual column, not the OrderStatus alias below — that alias
// is missing REFUNDED, which is a real value of orders.status.
const TERMINAL_ORDER_STATUSES: (typeof orders.$inferSelect)["status"][] = [
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

function mapSteadfastStatus(s: string): OrderStatus | null {
  switch (s) {
    case "delivered":
    case "partial_delivered":
    case "delivered_approval_pending":
    case "partial_delivered_approval_pending":
      return "DELIVERED";
    case "cancelled":
    case "cancelled_approval_pending":
      return "CANCELLED";
    case "hold":
    case "in_review":
    case "pending":
      return "PROCESSING";
    default:
      return null;
  }
}

// Shared by /sync/:orderId and /sync-batch so both stay consistent. Fetches
// the live status from Steadfast for one order and, if it maps to a
// different internal status than what's stored, persists the change + a
// timeline event. Does not fetch the order itself — callers pass it in so
// /sync-batch can load all target orders in a single query instead of N.
// `status` is typed as `string` (not the narrower OrderStatus) because the
// caller passes rows straight from the orders table, whose column type
// includes values like REFUNDED that this narrower alias doesn't — the value
// is only ever compared with `!==` here, never written back as-is.
// Every path below pays for a Steadfast round trip, so every path records what
// it got back. mapSteadfastStatus keeps only what fits this table's status
// enum and drops the rest, which is exactly the vocabulary the orders
// dashboard buckets on — storing the raw value is what lets the server decide
// those buckets itself. One statement for the whole batch: /track-batch can
// carry fifty orders, and fifty separate updates would undo the point of
// batching the fetches.
async function recordCourierStatuses(
  rows: { orderId: string; deliveryStatus: string }[],
) {
  if (rows.length === 0) return;
  const values = sql.join(
    rows.map((r) => sql`(${r.orderId}, ${r.deliveryStatus})`),
    sql`, `,
  );
  await db.execute(sql`
    UPDATE ${orders} AS o
    SET "courierStatus" = v.status, "courierStatusAt" = now()
    FROM (VALUES ${values}) AS v(id, status)
    WHERE o.id = v.id
  `);
}

async function syncOrderStatus(order: { id: string; orderNumber: string; status: string }) {
  const data = await getSteadfastStatusByInvoice(order.orderNumber);
  await recordCourierStatuses([
    { orderId: order.id, deliveryStatus: data.delivery_status },
  ]);
  const mapped = mapSteadfastStatus(data.delivery_status);
  const updated = !!mapped && mapped !== order.status;

  if (updated) {
    await db.update(orders)
      .set({ status: mapped as OrderStatus })
      .where(eq(orders.id, order.id));
    await db.insert(orderTimelineEvents).values({
      orderId: order.id,
      status: mapped as OrderStatus,
      message: `Status synced from Steadfast: ${data.delivery_status}`,
    });
  }

  // orderNumber travels with the result so a caller holding only the response
  // can say which order moved — the scheduled sync reports into Telegram, and
  // "order 7 of 23 changed" is not something an id answers.
  return { orderNumber: order.orderNumber, delivery_status: data.delivery_status, mapped, updated };
}

// The fan-out both batch routes perform: one Steadfast round trip per order,
// concurrently, with a failure on one order isolated from the rest.
async function syncOrders(
  targetOrders: { id: string; orderNumber: string; status: string }[],
) {
  const results: Record<
    string,
    | { orderNumber: string; delivery_status: string; mapped: OrderStatus | null; updated: boolean }
    | { error: string }
  > = {};

  await Promise.allSettled(
    targetOrders.map(async (order) => {
      try {
        results[order.id] = await syncOrderStatus(order);
      } catch (err) {
        console.error(`Steadfast sync error for order ${order.id}:`, err);
        results[order.id] = { error: "Failed to sync status" };
      }
    })
  );

  const updatedCount = Object.values(results).filter(
    (r) => "updated" in r && r.updated
  ).length;

  return { results, updatedCount, total: targetOrders.length };
}

const app = new Hono()

  .get("/balance", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!isAllowed(user, "orders", "balance", ["MODERATOR"])) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    try {
      const data = await getSteadfastBalance();
      return c.json(data);
    } catch (err) {
      console.error("Steadfast balance error:", err);
      return c.json({ error: "Failed to fetch balance" }, 500);
    }
  })

  .post(
    "/book",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        orderId: z.string(),
        recipient_phone: z.string().min(11).max(11),
        note: z.string().optional(),
        costPrices: z.array(z.object({
          orderItemId: z.string(),
          costPrice: z.number(),
        })).optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!isAllowed(user, "orders", "write", ["MODERATOR"])) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { orderId, recipient_phone, note, costPrices } = c.req.valid("json");

      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: { user: true },
      });

      if (!order) return c.json({ error: "Order not found" }, 404);

      if (costPrices && costPrices.length > 0) {
        // One statement for every line item instead of an UPDATE per item —
        // each of those was a separate round trip to the database.
        const cases = costPrices.map(
          (item) => sql`when ${orderItems.id} = ${item.orderItemId} then ${item.costPrice}`
        );
        await db.update(orderItems)
          .set({ costPrice: sql`(case ${sql.join(cases, sql.raw(" "))} else ${orderItems.costPrice} end)` })
          .where(inArray(orderItems.id, costPrices.map((i) => i.orderItemId)));
      }

      const address = [
        order.shippingAddress,
        order.shippingCity,
        order.shippingState,
        order.shippingPostalCode,
        order.shippingCountry,
      ]
        .filter(Boolean)
        .join(", ");

      const payload = {
        invoice: order.orderNumber,
        recipient_name: order.user?.name ?? order.guestName ?? "Guest",
        recipient_phone,
        recipient_address: address,
        cod_amount: order.paymentMethod === "COD" ? order.totalAmount : 0,
        note,
      };
      console.log("[Steadfast] booking payload:", JSON.stringify(payload));

      try {
        const result = await createSteadfastOrder(payload);

        // Check if order has bought price in order_items
        const [costCheck] = await db
          .select({
            hasBoughtPrice: sql<boolean>`EXISTS (
              SELECT 1 FROM order_items
              WHERE order_items."orderId" = ${orderId}
                AND order_items."costPrice" IS NOT NULL
                AND order_items."costPrice" > 0
            )`,
          })
          .from(orders)
          .where(eq(orders.id, orderId));

        const hasBoughtPrice = Boolean(costCheck?.hasBoughtPrice);

        await db.update(orders)
          .set({
            trackingNumber: result.consignment?.consignment_id?.toString() || result.consignment?.tracking_code || null,
            status: "PROCESSING",
            confirmedAt: hasBoughtPrice ? (order.confirmedAt ?? new Date()) : null,
          })
          .where(eq(orders.id, orderId));

        await db.insert(orderTimelineEvents).values({
          orderId,
          status: "PROCESSING",
          message: hasBoughtPrice
            ? `Booked with Steadfast Courier. Tracking: ${result.consignment?.tracking_code}. Consignment ID: ${result.consignment?.consignment_id}. Order confirmed with purchase price.`
            : `Booked with Steadfast Courier. Tracking: ${result.consignment?.tracking_code}. Consignment ID: ${result.consignment?.consignment_id}. (Purchase price pending).`,
        });

        return c.json({ success: true, consignment: result.consignment });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Booking failed";
        console.error("Steadfast booking error:", err);
        return c.json({ error: msg }, 500);
      }
    }
  )

  .get("/track/:orderId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!isAllowed(user, "orders", "read", ["MODERATOR"])) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const orderId = c.req.param("orderId");
    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return c.json({ error: "Order not found" }, 404);
    if (!order.trackingNumber) return c.json({ error: "No tracking number" }, 400);

    try {
      const data = await getSteadfastStatusByInvoice(order.orderNumber);
      await recordCourierStatuses([
        { orderId: order.id, deliveryStatus: data.delivery_status },
      ]);
      return c.json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        delivery_status: data.delivery_status,
        consignment: data.consignment ?? null,
      });
    } catch (err) {
      console.error("Steadfast track error:", err);
      return c.json({ error: "Failed to fetch tracking status" }, 500);
    }
  })

  .post(
    "/track-batch",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        orderIds: z.array(z.string()).min(1).max(50),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!isAllowed(user, "orders", "write", ["MODERATOR"])) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { orderIds } = c.req.valid("json");

      const trackedOrders = await db.query.orders.findMany({
        where: (o, { and, inArray, isNotNull, notInArray }) =>
          and(
            inArray(o.id, orderIds),
            isNotNull(o.trackingNumber),
            notInArray(o.status, TERMINAL_ORDER_STATUSES),
          ),
        columns: { id: true, orderNumber: true, trackingNumber: true },
      });

      const results: Record<string, { delivery_status: string; consignment_id?: number; tracking_code?: string }> = {};

      await Promise.allSettled(
        trackedOrders.map(async (order) => {
          try {
            const data = await getSteadfastStatusByInvoice(order.orderNumber);
            results[order.id] = {
              delivery_status: data.delivery_status,
              consignment_id: data.consignment?.consignment_id,
              tracking_code: data.consignment?.tracking_code,
            };
          } catch {
            // Skip failed fetches silently
          }
        })
      );

      await recordCourierStatuses(
        Object.entries(results).map(([orderId, r]) => ({
          orderId,
          deliveryStatus: r.delivery_status,
        })),
      );

      return c.json({ statuses: results });
    }
  )

  .post("/sync/:orderId", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!isAllowed(user, "orders", "write", ["MODERATOR"])) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const orderId = c.req.param("orderId");
    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return c.json({ error: "Order not found" }, 404);
    if (!order.trackingNumber) return c.json({ error: "No tracking number" }, 400);

    try {
      const result = await syncOrderStatus(order);
      return c.json(result);
    } catch (err) {
      console.error("Steadfast sync error:", err);
      return c.json({ error: "Failed to sync status" }, 500);
    }
  })

  // Same as /sync/:orderId but for many orders in one client request. The
  // "refresh all" button used to fire one POST per tracked order (dozens of
  // requests for one click) — this collapses that to a single round trip.
  // The N calls to Steadfast itself still happen (it has no bulk status
  // endpoint) but concurrently on the server via Promise.allSettled, so one
  // slow/failing order can't block the rest.
  .post(
    "/sync-batch",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        orderIds: z.array(z.string()).min(1).max(100),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!isAllowed(user, "orders", "write", ["MODERATOR"])) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { orderIds } = c.req.valid("json");

      const targetOrders = await db.query.orders.findMany({
        where: (o, { and, inArray, isNotNull, notInArray }) =>
          and(
            inArray(o.id, orderIds),
            isNotNull(o.trackingNumber),
            notInArray(o.status, TERMINAL_ORDER_STATUSES),
          ),
        columns: { id: true, orderNumber: true, status: true },
      });

      return c.json(await syncOrders(targetOrders));
    }
  )

  // Everything currently in the courier's hands, chosen server-side.
  // /sync-batch needs the caller to name the orders, so the dashboard can only
  // ever refresh the page it happens to be showing, and a scheduled job has no
  // page at all. That matters more than it used to: the orders list now buckets
  // on the stored courierStatus rather than refetching it per load, so nothing
  // moves an order out of CONFIRMED and into RETURNED unless something asks
  // Steadfast — and with no automatic refresh left, "something" was a person
  // pressing a button. This is the route a schedule calls.
  //
  // Ordered by least-recently-synced, nulls first, and capped: the in-flight
  // set is small (a couple of dozen) but it is business volume, not a bound,
  // and an uncapped Promise.allSettled against a third-party API is not
  // something to leave lying around. The ordering makes the cap rotate — each
  // run picks up whatever waited longest, so nothing is starved.
  .post("/sync-inflight", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!isAllowed(user, "orders", "write", ["MODERATOR"])) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const targetOrders = await db.query.orders.findMany({
      where: (o, { and, isNotNull, ne, notInArray }) =>
        and(
          isNotNull(o.trackingNumber),
          ne(o.trackingNumber, ""),
          notInArray(o.status, TERMINAL_ORDER_STATUSES),
        ),
      columns: { id: true, orderNumber: true, status: true },
      orderBy: (o, { asc, sql }) => [sql`${o.courierStatusAt} asc nulls first`, asc(o.createdAt)],
      limit: 100,
    });

    try {
      return c.json(await syncOrders(targetOrders));
    } catch (err) {
      console.error("Steadfast sync-inflight error:", err);
      return c.json({ error: "Failed to sync statuses" }, 500);
    }
  });

export default app;
