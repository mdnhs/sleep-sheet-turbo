import { Hono } from "hono";
import { batch, db } from "@/db";
import { orders, orderItems, payments, paymentLogs, orderTimelineEvents, users, products, blockedIps } from "@/db/schema";
import { eq, ne, and, or, not, ilike, inArray, desc, gte, lte, sql, count } from "drizzle-orm";
import { awaitingBkashPayment } from "@/lib/bkash-orders";
import { BkashError, getBkashConfig, isBkashConfigured, refundBkashPayment } from "@/lib/bkash";
import { recordPaymentLog } from "@/lib/payment-logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { isAllowed } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { totalAfterSubtotalChange } from "@/lib/order-totals";
import { sameOrderNumber, toOrderSummary } from "@/features/order/server/track-order";
import { toCustomerOrder } from "@/features/order/server/customer-order";
import { setActivityMeta, summarizeNames, titleCase, type ActivityChange } from "@/features/activity/server/log-activity";
import { retractGoogleAdsConversion } from "@/lib/google-ads/retract-order";
import {
  isPendingSql,
  isConfirmedSql,
  isDeliveredSql,
  isCancelledSql,
  isReturnedSql,
  isTodaySqlFor,
  todayRange,
  bucketFor,
} from "./status-buckets";

// Order-related activity log entries (update/cancel/refund/delete) attach
// this snapshot as extra `changes` rows — labelled "Customer", "Phone",
// "Address", "Products" — so the activity dialog can show who/what/where an
// action touched. Kept in `changes` (not a new column) so it survives a
// deleted order with no schema change and no live join back to a row that
// may no longer exist.
function buildOrderContext(order: {
  guestName: string | null;
  guestPhone: string | null;
  shippingAddress: string;
  user?: { name: string; phone: string | null } | null;
  items: { quantity: number; product?: { name: string } | null }[];
}): ActivityChange[] {
  const customerName = order.user?.name ?? order.guestName ?? "Guest";
  const customerPhone = order.user?.phone ?? order.guestPhone;
  const productsSummary = order.items
    .map((it) => `${it.product?.name ?? "Unknown product"} ×${it.quantity}`)
    .join(", ");

  const context: ActivityChange[] = [{ label: "Customer", to: customerName }];
  if (customerPhone) context.push({ label: "Phone", to: customerPhone });
  context.push({ label: "Address", to: order.shippingAddress });
  if (productsSummary) context.push({ label: "Products", to: productsSummary });
  return context;
}

const app = new Hono()

.get("/", sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "orders", "read", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { search, from, to, limit, offset, status, tzOffset } = c.req.query();

  try {
    // Status buckets and the viewer's "today" window are defined in
    // ./status-buckets, where they are covered by tests against a real
    // Postgres — the NULL handling and the deliberate bucket overlap are the
    // kind of thing a comment cannot keep honest.
    const { from: todayFrom, to: todayTo } = todayRange(tzOffset);
    const isTodaySql = isTodaySqlFor({ from: todayFrom, to: todayTo });

    // Search and date range narrow what the whole screen is about; the status
    // bucket then picks one slice of that. They are kept apart because the
    // filter tabs count every bucket within the current search, so those
    // counts must not themselves be filtered down to one bucket.
    // Orders still waiting on (or that failed) a bKash payment are not real
    // orders yet — keeping them out of the list means nobody ships one unpaid.
    const baseConditions = [not(awaitingBkashPayment!)];

    if (search) {
      // Matching a customer's name or email needs the users join, which the
      // relational query below cannot express in its own where clause. As a
      // subquery it resolves inside the same statement, rather than the round
      // trip that fetching every matching id up front used to cost.
      baseConditions.push(inArray(
        orders.id,
        db.select({ id: orders.id })
          .from(orders)
          .leftJoin(users, eq(orders.userId, users.id))
          .where(or(
            ilike(orders.orderNumber, `%${search}%`),
            ilike(users.name, `%${search}%`),
            ilike(users.email, `%${search}%`)
          )),
      ));
    }

    let fromDate: Date | null = null;
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) {
        if (!from.includes("T")) d.setHours(0, 0, 0, 0);
        fromDate = d;
      }
    }
    let toDate: Date | null = null;
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        if (!to.includes("T") || d.getHours() === 0) d.setHours(23, 59, 59, 999);
        toDate = d;
      }
    }
    if (fromDate) baseConditions.push(sql`${orders.createdAt} >= ${fromDate.toISOString()}::timestamp`);
    if (toDate) baseConditions.push(sql`${orders.createdAt} <= ${toDate.toISOString()}::timestamp`);

    const bucket = bucketFor(status, isTodaySql);

    const baseWhere = baseConditions.length > 0 ? and(...baseConditions) : undefined;
    const where = bucket ? and(...baseConditions, bucket) : baseWhere;

    // Every bucket counted in one pass over the search/date scope. These feed
    // the filter tabs, which have to keep showing "Confirmed (194)" while you
    // are looking at the pending ones — and the count for the bucket in view
    // doubles as the row total the pager needs, so this replaces rather than
    // adds to the queries a page load already made.
    const [counts] = await db
      .select({
        all: count(),
        today: sql<number>`count(*) FILTER (WHERE ${isTodaySql})`.mapWith(Number),
        pending: sql<number>`count(*) FILTER (WHERE ${isPendingSql})`.mapWith(Number),
        confirmed: sql<number>`count(*) FILTER (WHERE ${isConfirmedSql})`.mapWith(Number),
        delivered: sql<number>`count(*) FILTER (WHERE ${isDeliveredSql})`.mapWith(Number),
        cancelled: sql<number>`count(*) FILTER (WHERE ${isCancelledSql})`.mapWith(Number),
        returned: sql<number>`count(*) FILTER (WHERE ${isReturnedSql})`.mapWith(Number),
      })
      .from(orders)
      .where(baseWhere);

    const total =
      status === "PENDING" ? counts.pending
      : status === "CONFIRMED" ? counts.confirmed
      : status === "DELIVERED" ? counts.delivered
      : status === "CANCELLED" ? counts.cancelled
      : status === "RETURNED" ? counts.returned
      : status === "TODAY" ? counts.today
      : counts.all;

    // A page is only taken when the caller asks for one. The Telegram lookup
    // bot and the dashboard both do; anything else still gets the full set.
    const take = limit ? Math.min(Math.max(parseInt(limit, 10) || 0, 1), 200) : undefined;
    const skip = offset ? Math.max(parseInt(offset, 10) || 0, 0) : 0;

    // Two phases, because LIMIT/OFFSET on the joined query is not the cheap
    // thing it looks like. The user/items joins live in the select list, so
    // Postgres runs them for every row OFFSET then throws away: measured on
    // production, page 1 costs 170 buffers while OFFSET 175 costs 1,298 —
    // about what fetching all 203 orders unpaginated cost. Paging the ids
    // first touches a narrow 34-byte row instead of a 1,264-byte one, and the
    // second query joins exactly the rows being returned, so the cost is flat
    // at any depth: the same OFFSET 175 comes to 186 buffers.
    //
    // Only worth it when a page was actually asked for. Without a limit the id
    // pass would select every id and buy nothing, so that case queries directly.
    const pageIds =
      take === undefined
        ? null
        : (
            await db
              .select({ id: orders.id })
              .from(orders)
              .where(where)
              .orderBy(
                status === "TODAY"
                  ? desc(orders.confirmedAt)
                  : desc(orders.createdAt),
                desc(orders.id)
              )
              .limit(take)
              .offset(skip)
          ).map((r) => r.id);

    const ordersList = pageIds?.length === 0 ? [] : await db.query.orders.findMany({
      where: pageIds ? inArray(orders.id, pageIds) : where,
      with: {
        user: {
          columns: { id: true, name: true, email: true, phone: true }
        },
        items: {
          // Only the product fields the orders dashboard actually renders.
          // Pulling whole product rows dragged description, tags, features,
          // care instructions and variants along for every line item of
          // every order — a large payload to scan, serialize and transfer
          // on each dashboard load. addOns is kept: its costPrice drives
          // the add-on bought-price fields in the order cost dialogs.
          with: {
            product: {
              columns: { id: true, name: true, images: true, price: true, sku: true, addOns: true, variants: true, sizes: true, stock: true }
            }
          }
        },
        shippingMethod: true,
        payment: true,
        paymentLogs: {
          orderBy: (logs, { desc }) => [desc(logs.createdAt)]
        }
      },
      // Same key as the id pass above, id included: createdAt alone is not
      // unique, and two rows sharing a millisecond could otherwise land on two
      // pages or on none.
      orderBy: (fields, { desc }) =>
        status === "TODAY"
          ? [desc(fields.confirmedAt), desc(fields.id)]
          : [desc(fields.createdAt), desc(fields.id)]
    });

    return c.json({ orders: ordersList, total, counts });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return c.json({ error: "Failed to fetch orders" }, 500);
  }
})

.patch("/:id", sessionMiddleware, zValidator("json", z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).optional(),
  paymentStatus: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]).optional(),
  shippingCost: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  shippingAddress: z.string().optional(),
  reference: z.string().nullable().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    productId: z.string(),
    quantity: z.number().int().min(1),
    price: z.number().min(0),
    costPrice: z.number().min(0).nullable().optional(),
    size: z.string().nullable().optional(),
    color: z.string().nullable().optional()
  })).optional()
})), async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "orders", "write", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const { status, paymentStatus, shippingCost, totalAmount, guestName, guestPhone, shippingAddress, reference, items } = c.req.valid("json");

  // Changing money (shipping, total, item cost) or modifying items needs the refund/amounts perm.
  const changesAmounts =
    shippingCost !== undefined || totalAmount !== undefined || items !== undefined;
  if (changesAmounts && !isAllowed(user, "orders", "refund", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const statusMessages: Record<string, string> = {
    PENDING: "Order placed and pending confirmation.",
    PROCESSING: "Order is being processed.",
    SHIPPED: "Order has been shipped.",
    DELIVERED: "Order delivered to customer.",
    CANCELLED: "Order was cancelled by the user or admin.",
  };

  try {
    const currentOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        items: true
      }
    });
    
    if (!currentOrder) {
      return c.json({ error: "Order not found" }, 404);
    }

    if (items !== undefined && items.length === 0) {
      return c.json({ error: "Order must have at least one product" }, 400);
    }

    const updateFields: Partial<typeof orders.$inferInsert> = {};
    if (status !== undefined) updateFields.status = status;
    if (paymentStatus !== undefined) updateFields.paymentStatus = paymentStatus;
    if (guestName !== undefined) updateFields.guestName = guestName;
    if (guestPhone !== undefined) updateFields.guestPhone = guestPhone;
    if (shippingAddress !== undefined) updateFields.shippingAddress = shippingAddress;
    if (reference !== undefined) updateFields.reference = reference || null;
    
    // shippingCost is the admin's total delivery cost; editing it never changes what the customer pays.
    if (shippingCost !== undefined) {
      updateFields.shippingCost = shippingCost;
    }

    if (status === "PENDING") {
      updateFields.confirmedAt = null;
    }

    let purchasePriceJustAdded = false;
    if (items !== undefined) {
      const hasAnyCostPrice = items.some(
        (it) => it.costPrice !== null && it.costPrice !== undefined && Number(it.costPrice) > 0
      );

      const hasBooking = Boolean(
        (currentOrder.trackingNumber && currentOrder.trackingNumber !== "") ||
        (currentOrder.saleType === "POS" && currentOrder.shippingAddress?.includes("In-store pickup"))
      );

      if (hasAnyCostPrice && hasBooking) {
        if (currentOrder.status === "PENDING" || !currentOrder.confirmedAt) {
          updateFields.confirmedAt = new Date();
          if (status === undefined) {
            updateFields.status = "PROCESSING";
          }
          purchasePriceJustAdded = true;
        }
      } else {
        updateFields.confirmedAt = null;
        if (status === undefined && currentOrder.status !== "CANCELLED" && currentOrder.status !== "DELIVERED") {
          updateFields.status = "PENDING";
        }
      }
    }

    // Every write below — order item changes, stock deltas, the order row
    // itself, the customer name/phone sync, and the timeline entry — must
    // commit together or not at all: a mid-way failure used to be able to
    // leave stock decremented with no matching item change, or an order
    // total that no longer matches its line items, because each statement
    // was awaited individually with nothing to roll the others back. Every
    // write is now collected here and run inside one Postgres transaction,
    // the same pattern checkout/POS use for order creation.
    await db.transaction(async (tx) => {
      const statements: PromiseLike<unknown>[] = [];

      // Inventory & item adjustments
      if (items !== undefined) {
        const existingItemsMap = new Map(currentOrder.items.map((it) => [it.id, it]));
        const stockDeltas = new Map<string, number>();

        const addDelta = (productId: string | null | undefined, delta: number) => {
          if (!productId || delta === 0) return;
          stockDeltas.set(productId, (stockDeltas.get(productId) ?? 0) + delta);
        };

        const keptItemIds = new Set<string>();

        for (const item of items) {
          if (item.id && existingItemsMap.has(item.id)) {
            keptItemIds.add(item.id);
            const existing = existingItemsMap.get(item.id)!;

            if (existing.productId === item.productId) {
              // Same product: delta = oldQty - newQty (positive restores stock, negative deducts)
              addDelta(item.productId, existing.quantity - item.quantity);
            } else {
              // Product switched: restore old product stock, deduct new product stock
              addDelta(existing.productId, existing.quantity);
              addDelta(item.productId, -item.quantity);
            }

            statements.push(
              tx.update(orderItems)
                .set({
                  productId: item.productId,
                  quantity: item.quantity,
                  price: item.price,
                  costPrice: item.costPrice !== undefined ? item.costPrice : null,
                  size: item.size ?? null,
                  color: item.color ?? null,
                })
                .where(eq(orderItems.id, item.id))
            );
          } else {
            // Brand new item in this order
            addDelta(item.productId, -item.quantity);

            statements.push(
              tx.insert(orderItems).values({
                orderId: id,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                costPrice: item.costPrice !== undefined ? item.costPrice : null,
                size: item.size ?? null,
                color: item.color ?? null,
              })
            );
          }
        }

        // Check for removed items
        for (const existing of currentOrder.items) {
          if (!keptItemIds.has(existing.id)) {
            addDelta(existing.productId, existing.quantity);
            statements.push(tx.delete(orderItems).where(eq(orderItems.id, existing.id)));
          }
        }

        // Apply inventory stock adjustments
        for (const [productId, delta] of stockDeltas.entries()) {
          if (delta !== 0) {
            statements.push(
              tx.update(products)
                .set({
                  stock: sql`GREATEST(0, ${products.stock} + ${delta})`,
                })
                .where(eq(products.id, productId))
            );
          }
        }

        const newSubtotal = items.reduce((sum, it) => sum + (it.price * it.quantity), 0);
        updateFields.subtotal = newSubtotal;

        updateFields.totalAmount = totalAmount ?? totalAfterSubtotalChange(currentOrder.totalAmount, currentOrder.subtotal, newSubtotal);
      } else if (totalAmount !== undefined) {
        updateFields.totalAmount = totalAmount;
      }

      statements.push(tx.update(orders).set(updateFields).where(eq(orders.id, id)));

      // Keep user record in sync if user exists
      if (currentOrder.userId && (guestName !== undefined || guestPhone !== undefined)) {
        const userUpdate: { name?: string; phone?: string } = {};
        if (guestName !== undefined) userUpdate.name = guestName;
        if (guestPhone !== undefined) userUpdate.phone = guestPhone;
        statements.push(tx.update(users).set(userUpdate).where(eq(users.id, currentOrder.userId)));
      }

      if (purchasePriceJustAdded) {
        statements.push(
          tx.insert(orderTimelineEvents).values({
            orderId: id,
            status: updateFields.status ?? "PROCESSING",
            message: "Order confirmed with purchase price added by admin.",
          })
        );
      } else if (status !== undefined || paymentStatus !== undefined) {
        const newStatus = status ?? currentOrder.status;
        const newPaymentStatus = paymentStatus ?? currentOrder.paymentStatus;
        statements.push(
          tx.insert(orderTimelineEvents).values({
            orderId: id,
            status: newStatus,
            message: `${statusMessages[newStatus] || `Status changed to ${newStatus}`}, payment status is now ${newPaymentStatus.toLowerCase()}.`
          })
        );
      } else if (items !== undefined || guestName !== undefined || guestPhone !== undefined || shippingAddress !== undefined) {
        statements.push(
          tx.insert(orderTimelineEvents).values({
            orderId: id,
            status: currentOrder.status,
            message: `Order details updated by admin${items ? ` (${items.length} item${items.length > 1 ? "s" : ""})` : ""}.`
          })
        );
      }

      for (const statement of statements) await statement;
    });

    const updatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        user: true,
        items: {
          with: {
            product: {
              columns: { id: true, name: true, images: true, price: true, sku: true, addOns: true, variants: true, sizes: true, stock: true }
            }
          }
        },
        shippingMethod: true,
        payment: true
      }
    });

    const changes: ActivityChange[] = [];
    if (status !== undefined && status !== currentOrder.status) {
      changes.push({ label: "Status", from: titleCase(currentOrder.status), to: titleCase(status) });
    }
    if (paymentStatus !== undefined && paymentStatus !== currentOrder.paymentStatus) {
      changes.push({ label: "Payment status", from: titleCase(currentOrder.paymentStatus), to: titleCase(paymentStatus) });
    }
    if (shippingCost !== undefined && shippingCost !== currentOrder.shippingCost) {
      changes.push({ label: "Shipping cost", from: currentOrder.shippingCost, to: shippingCost });
    }
    if (totalAmount !== undefined && totalAmount !== currentOrder.totalAmount) {
      changes.push({ label: "Total amount", from: currentOrder.totalAmount, to: totalAmount });
    }
    if (guestName !== undefined && guestName !== currentOrder.guestName) {
      changes.push({ label: "Customer name", from: currentOrder.guestName ?? "None", to: guestName });
    }
    if (guestPhone !== undefined && guestPhone !== currentOrder.guestPhone) {
      changes.push({ label: "Customer phone", from: currentOrder.guestPhone ?? "None", to: guestPhone });
    }
    if (shippingAddress !== undefined && shippingAddress !== currentOrder.shippingAddress) {
      changes.push({ label: "Shipping address", from: currentOrder.shippingAddress, to: shippingAddress });
    }
    if (items !== undefined) {
      changes.push({ label: "Items count", from: currentOrder.items?.length ?? 0, to: items.length });
    }
    if (updatedOrder) changes.push(...buildOrderContext(updatedOrder));
    setActivityMeta(c, { name: `#${currentOrder.orderNumber}`, changes });

    return c.json(updatedOrder);
  } catch (error) {
    console.error("Failed to update order:", error);
    return c.json({ error: "Failed to update order" }, 500);
  }
})

.post("/:id/cancel", sessionMiddleware, zValidator("json", z.object({
  reason: z.string().max(500).optional(),
  restock: z.boolean().optional().default(true),
})), async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "orders", "cancel", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const { reason, restock } = c.req.valid("json");

  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true },
    });

    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    // Fast-path message for the obvious case. The real guard against
    // double-cancelling (two tabs, a double-click) is the WHERE clause on
    // the update below — this check alone has a read-then-write gap.
    if (order.status === "CANCELLED") {
      return c.json({ error: "Order is already cancelled" }, 400);
    }

    // Conditional update: only matches while the order isn't already
    // cancelled. Postgres serializes concurrent updates to the same row, so
    // of two concurrent cancel requests only the first to commit can match
    // this WHERE — the second re-evaluates it against the now-CANCELLED row
    // and gets zero rows back, instead of both passing the check above and
    // both restocking the same order.
    const [updated] = await db.update(orders)
      .set({
        status: "CANCELLED",
        cancellationReason: reason ?? order.cancellationReason ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, id), ne(orders.status, "CANCELLED")))
      .returning();

    if (!updated) {
      return c.json({ error: "Order is already cancelled" }, 400);
    }

    // The status flip above is now guaranteed exclusive, so batching the
    // restock + timeline entry together no longer needs its own guard.
    await db.transaction(async (tx) => {
      await tx.insert(orderTimelineEvents).values({
        orderId: id,
        status: "CANCELLED",
        message:
          `Order cancelled` +
          (reason ? ` — ${reason}` : "") +
          (restock ? ". Items restocked." : "."),
      });

      // Return the reserved goods to inventory.
      if (restock) {
        for (const item of order.items) {
          if (!item.productId) continue;
          await tx.update(products)
            .set({ stock: sql`${products.stock} + ${item.quantity}` })
            .where(eq(products.id, item.productId));
        }
      }
    });

    const updatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        user: true,
        items: { with: { product: { columns: { name: true } } } },
      },
    });

    setActivityMeta(c, {
      name: `#${order.orderNumber}`,
      changes: [
        { label: "Status", from: titleCase(order.status), to: "Cancelled" },
        ...(reason ? [{ label: "Reason", to: reason } as ActivityChange] : []),
        ...(updatedOrder ? buildOrderContext(updatedOrder) : []),
      ],
    });

    return c.json(updatedOrder);
  } catch (error) {
    console.error("Failed to cancel order:", error);
    return c.json({ error: "Failed to cancel order" }, 500);
  }
})

.post("/:id/refund", sessionMiddleware, zValidator("json", z.object({
  amount: z.number().positive(),
  reason: z.string().max(500).optional(),
  restock: z.boolean().optional().default(true),
})), async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "orders", "refund", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const { amount, reason, restock } = c.req.valid("json");

  // Round to 2dp throughout so float noise never blocks a valid full refund
  // or lets a refund creep a cent over the total.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const EPS = 0.005;

  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true },
    });

    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.status === "CANCELLED") {
      return c.json({ error: "A cancelled order cannot be refunded" }, 400);
    }

    const alreadyRefunded = order.refundedAmount ?? 0;
    const refundable = round2(order.totalAmount - alreadyRefunded);
    if (refundable <= 0) {
      return c.json({ error: "Order is already fully refunded" }, 400);
    }

    const refundAmount = round2(amount);
    if (refundAmount > refundable + EPS) {
      return c.json(
        { error: `Refund exceeds the refundable amount (${refundable})` },
        400,
      );
    }

    const newRefunded = round2(alreadyRefunded + refundAmount);
    const isFull = newRefunded >= order.totalAmount - EPS;
    // True only on the single transition into a fully-refunded state, so we
    // never restock the same order twice across repeated partial refunds.
    const becameFull = isFull && alreadyRefunded < order.totalAmount - EPS;

    const updateFields: Partial<typeof orders.$inferInsert> = {
      refundedAmount: newRefunded,
      refundReason: reason ?? order.refundReason ?? null,
      refundedAt: new Date(),
      paymentStatus: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED",
      updatedAt: new Date(),
    };
    // A full refund also moves the order itself to REFUNDED; partial refunds
    // leave the fulfilment status (e.g. DELIVERED) untouched.
    if (isFull) updateFields.status = "REFUNDED";

    // Conditional update: only applies while refundedAmount still equals
    // what we read above (compare-and-swap on the exact value) and the
    // order hasn't been cancelled meanwhile. Two concurrent refund requests
    // (two tabs, a double-click) can both read the same alreadyRefunded and
    // both pass the "within refundable" check earlier — without this WHERE,
    // both writes would apply and the total refunded could exceed
    // totalAmount, which nothing else in the request path catches. The
    // `orders_refunded_amount_within_total` CHECK constraint (see migration
    // 0021) is the last-resort backstop if this guard is ever bypassed.
    const [updated] = await db.update(orders)
      .set({
        status: "CANCELLED",
        cancellationReason: reason ?? order.cancellationReason ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, id), ne(orders.status, "CANCELLED")))
      .returning();

    if (!updated) {
      return c.json({ error: "Order is already cancelled" }, 400);
    }

    // The status flip above is now guaranteed exclusive, so batching the
    // restock + timeline entry together no longer needs its own guard.
    await db.transaction(async (tx) => {
      await tx.insert(orderTimelineEvents).values({
        orderId: id,
        status: "CANCELLED",
        message:
          `Order cancelled` +
          (reason ? ` — ${reason}` : "") +
          (restock ? ". Items restocked." : "."),
      });

      // Return the reserved goods to inventory.
      if (restock) {
        for (const item of order.items) {
          if (!item.productId) continue;
          await tx.update(products)
            .set({ stock: sql`${products.stock} + ${item.quantity}` })
            .where(eq(products.id, item.productId));
        }
      }
    });

    const updatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        user: true,
        items: { with: { product: { columns: { name: true } } } },
      },
    });

    setActivityMeta(c, {
      name: `#${order.orderNumber}`,
      changes: [
        { label: "Status", from: titleCase(order.status), to: "Cancelled" },
        ...(reason ? [{ label: "Reason", to: reason } as ActivityChange] : []),
        ...(updatedOrder ? buildOrderContext(updatedOrder) : []),
      ],
    });

    return c.json(updatedOrder);
  } catch (error) {
    console.error("Failed to cancel order:", error);
    return c.json({ error: "Failed to cancel order" }, 500);
  }
})

.post("/:id/refund", sessionMiddleware, zValidator("json", z.object({
  amount: z.number().positive(),
  reason: z.string().max(500).optional(),
  restock: z.boolean().optional().default(true),
})), async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "orders", "refund", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const { amount, reason, restock } = c.req.valid("json");

  // Round to 2dp throughout so float noise never blocks a valid full refund
  // or lets a refund creep a cent over the total.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const EPS = 0.005;

  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true },
    });

    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.status === "CANCELLED") {
      return c.json({ error: "A cancelled order cannot be refunded" }, 400);
    }

    const alreadyRefunded = order.refundedAmount ?? 0;
    const refundable = round2(order.totalAmount - alreadyRefunded);
    if (refundable <= 0) {
      return c.json({ error: "Order is already fully refunded" }, 400);
    }

    const refundAmount = round2(amount);
    if (refundAmount > refundable + EPS) {
      return c.json(
        { error: `Refund exceeds the refundable amount (${refundable})` },
        400,
      );
    }

    const newRefunded = round2(alreadyRefunded + refundAmount);
    const isFull = newRefunded >= order.totalAmount - EPS;
    // True only on the single transition into a fully-refunded state, so we
    // never restock the same order twice across repeated partial refunds.
    const becameFull = isFull && alreadyRefunded < order.totalAmount - EPS;

    const updateFields: Partial<typeof orders.$inferInsert> = {
      refundedAmount: newRefunded,
      refundReason: reason ?? order.refundReason ?? null,
      refundedAt: new Date(),
      paymentStatus: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED",
      updatedAt: new Date(),
    };
    // A full refund also moves the order itself to REFUNDED; partial refunds
    // leave the fulfilment status (e.g. DELIVERED) untouched.
    if (isFull) updateFields.status = "REFUNDED";

    // Conditional update: only applies while refundedAmount still equals
    // what we read above (compare-and-swap on the exact value) and the
    // order hasn't been cancelled meanwhile. Two concurrent refund requests
    // (two tabs, a double-click) can both read the same alreadyRefunded and
    // both pass the "within refundable" check earlier — without this WHERE,
    // both writes would apply and the total refunded could exceed
    // totalAmount, which nothing else in the request path catches. The
    // `orders_refunded_amount_within_total` CHECK constraint (see migration
    // 0021) is the last-resort backstop if this guard is ever bypassed.
    // Checklist item 5: Process bKash Refund API using stored token if order was paid via bKash
    if (order.paymentMethod === "BKASH") {
      const bkashConfig = await getBkashConfig();
      if (isBkashConfigured(bkashConfig)) {
        const logs = await db.query.paymentLogs.findMany({
          where: eq(paymentLogs.orderId, id),
        });
        const executeLog = logs.find((l) => l.endpoint === "/execute" && l.isSuccess);
        const createLog = logs.find((l) => l.endpoint === "/create" && l.paymentId);
        const paymentID = executeLog?.paymentId || createLog?.paymentId;
        const trxID = executeLog?.trxId || order.reference?.replace(/^bKash TrxID:\s*/, "");

        if (paymentID && trxID) {
          try {
            const refundRes = await refundBkashPayment(bkashConfig, {
              paymentID,
              trxID,
              amount: refundAmount,
              reason: reason ?? undefined,
            });

            await recordPaymentLog({
              orderId: order.id,
              orderNumber: order.orderNumber,
              endpoint: "/payment/refund",
              paymentId: paymentID,
              trxId: refundRes.refundTrxID || trxID,
              amount: refundAmount,
              request: { paymentID, trxID, amount: refundAmount, reason },
              response: refundRes,
              statusCode: refundRes.statusCode,
              statusMessage: refundRes.statusMessage,
              isSuccess: refundRes.statusCode === "0000",
            });
          } catch (bkashErr) {
            const msg = bkashErr instanceof BkashError ? bkashErr.message : "bKash refund failed";
            await recordPaymentLog({
              orderId: order.id,
              orderNumber: order.orderNumber,
              endpoint: "/payment/refund",
              paymentId: paymentID,
              trxId: trxID,
              amount: refundAmount,
              request: { paymentID, trxID, amount: refundAmount, reason },
              statusCode: bkashErr instanceof BkashError ? bkashErr.statusCode : "ERROR",
              statusMessage: msg,
              isSuccess: false,
            });
            return c.json({ error: `bKash Refund rejected: ${msg}` }, 400);
          }
        }
      }
    }

    const [updated] = await db.update(orders)
      .set(updateFields)
      .where(and(
        eq(orders.id, id),
        eq(orders.refundedAmount, alreadyRefunded),
        ne(orders.status, "CANCELLED"),
      ))
      .returning();

    if (!updated) {
      return c.json({ error: "Refund amount changed by another request, please retry" }, 409);
    }

    await db.transaction(async (tx) => {
      await tx.insert(orderTimelineEvents).values({
        orderId: id,
        status: isFull ? "REFUNDED" : order.status,
        message:
          `Refund of ${refundAmount} processed` +
          (reason ? ` — ${reason}` : "") +
          `. Total refunded ${newRefunded} of ${order.totalAmount}` +
          (isFull ? " (fully refunded)." : "."),
      });

      // Restock the returned goods only when the order becomes fully refunded —
      // an amount-based partial refund doesn't identify which items came back.
      if (restock && becameFull) {
        for (const item of order.items) {
          if (!item.productId) continue;
          await tx.update(products)
            .set({ stock: sql`${products.stock} + ${item.quantity}` })
            .where(eq(products.id, item.productId));
        }
      }
    });

    const updatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        user: true,
        items: { with: { product: { columns: { name: true } } } },
      },
    });

    setActivityMeta(c, {
      name: `#${order.orderNumber}`,
      changes: [
        { label: "Refunded amount", from: alreadyRefunded, to: newRefunded },
        { label: "Payment status", from: titleCase(order.paymentStatus), to: isFull ? "Refunded" : "Partially Refunded" },
        ...(reason ? [{ label: "Reason", to: reason } as ActivityChange] : []),
        ...(updatedOrder ? buildOrderContext(updatedOrder) : []),
      ],
    });

    return c.json(updatedOrder);
  } catch (error) {
    console.error("Failed to refund order:", error);
    return c.json({ error: "Failed to refund order" }, 500);
  }
})

.delete("/:id", sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "orders", "delete", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  try {
      // Fetched in full (not just orderNumber) before the delete below, since
      // this is the only chance to snapshot who/what/where this order was —
      // once the rows are gone, nothing can recover it for the activity log.
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, id),
        with: {
          user: true,
          items: { with: { product: { columns: { name: true } } } },
        },
      });

      // blockedIps.orderId has no ON DELETE cascade, so a block record tied to
      // this order would otherwise leave a dangling FK and fail the delete
      // below with a constraint violation. Detach it instead of deleting it —
      // the block itself (and its audit trail) should outlive the order.
      //
      // All five statements run in one batch (one Postgres transaction):
      // a failure partway through used to leave orphaned order_items/payments
      // rows pointing at a still-existing order, or — worse — at an order id
      // that no longer exists once a later statement in the same request
      // eventually succeeded on retry.
      await batch((tx) => [
        tx.update(blockedIps).set({ orderId: null }).where(eq(blockedIps.orderId, id)),
        tx.delete(orderItems).where(eq(orderItems.orderId, id)),
        tx.delete(payments).where(eq(payments.orderId, id)),
        tx.delete(orderTimelineEvents).where(eq(orderTimelineEvents.orderId, id)),
        tx.delete(orders).where(eq(orders.id, id)),
      ]);

      if (order) {
        setActivityMeta(c, {
          name: `#${order.orderNumber}`,
          changes: buildOrderContext(order),
        });

        // Retract conversion in Google Ads if this was a website order (ORD-)
        if (order.orderNumber && order.orderNumber.toUpperCase().startsWith("ORD-")) {
          void retractGoogleAdsConversion(order.orderNumber).catch((err) => {
            console.error(`[google-ads] Retraction failed for order ${order.orderNumber}:`, err);
          });
        }
      }

    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to delete order:", error);
    return c.json({ error: "Failed to delete order" }, 500);
  }
})

.post("/bulk-delete", sessionMiddleware, zValidator("json", z.object({
  // Capped: an unbounded array here is an unbounded IN (...) clause across
  // five statements — a large enough list risks a request timeout as much
  // as it risks anything else. 200 comfortably covers a real bulk-select
  // from the orders table (which pages at up to 200 rows itself).
  ids: z.array(z.string()).min(1).max(200),
})), async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "orders", "delete", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { ids } = c.req.valid("json");

  try {
    const targetOrders = await db.query.orders.findMany({
      where: inArray(orders.id, ids),
      columns: { orderNumber: true },
    });

    // See the single-order delete route above for why this batches.
    await batch((tx) => [
      tx.update(blockedIps).set({ orderId: null }).where(inArray(blockedIps.orderId, ids)),
      tx.delete(orderItems).where(inArray(orderItems.orderId, ids)),
      tx.delete(payments).where(inArray(payments.orderId, ids)),
      tx.delete(orderTimelineEvents).where(inArray(orderTimelineEvents.orderId, ids)),
      tx.delete(orders).where(inArray(orders.id, ids)),
    ]);

    setActivityMeta(c, {
      name: `${targetOrders.length} orders: ${summarizeNames(targetOrders.map((o) => `#${o.orderNumber}`))}`,
    });

    // Retract conversions in Google Ads for any website orders (ORD-)
    const ordNumbers = targetOrders
      .map((o) => o.orderNumber)
      .filter((num) => typeof num === "string" && num.toUpperCase().startsWith("ORD-"));

    if (ordNumbers.length > 0) {
      void retractGoogleAdsConversion(ordNumbers).catch((err) => {
        console.error("[google-ads] Bulk conversion retraction failed:", err);
      });
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to bulk delete orders:", error);
    return c.json({ error: "Failed to bulk delete orders" }, 500);
  }
})

.get("/order", sessionMiddleware, async(c)=>{
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try{
    const order = await db.query.orders.findMany({
      where: eq(orders.userId, user.id),
      // `reference` holds a pending bKash paymentID, which the bKash callback
      // accepts as proof of payment state; the account page never renders it.
      columns: { reference: false },
      with: {
        items: {
          // costPrice is what the store paid: staff-only, same as GET /:id.
          columns: { costPrice: false },
          // This is the account page's order summary list — it renders
          // order.items.length and never reads a product field directly
          // (the order detail page fetches the full row separately via
          // GET /orders/:id). Pulling whole product rows here dragged
          // description, tags, features, care instructions and variants
          // along for every line item of every order on every account-page
          // load for no reason (over-fetching flagged in the 2026-09-21
          // audit) — same trimmed column set the orders dashboard list uses.
          with: {
            product: {
              columns: { id: true, name: true, images: true, price: true, sku: true }
            }
          }
        }
      }
    });
    return c.json({order}, 200);
  }
  catch(error){
    console.error("Failed to Fetch Order",error)
    return c.json({error: "Failed to Fetch Order"},500)
  }
})

// Reachable without a session on purpose: this is what powers the public
// "Track your order" page (app/(client)/track-order/page.tsx), where a
// customer who never registered — and has no order id handy — looks their
// orders up by the phone number they checked out or bought in-store with.
// It used to require staff's orders:read, which nothing dashboard-side ever
// actually called (grep confirms the track-order page is its only caller) —
// so the public page has likely been silently 401ing for every real
// customer who used it.
//
// Making it public trades one boundary for another: phone number is a much
// weaker secret than an order id (10-11 digits, guessable), so this can't
// return the same staff-shaped row the way GET /:id does for its id-only
// callers. Two tiers, both deny-by-default via `columns` below (fraud/device
// metadata, the linked account and the internal timeline never come back):
//   - phone alone: toOrderSummary per order, i.e. what it is and where it
//     stands, with no name, address, note, id, order number or tracking number.
//   - phone + order number: that one order in full (address, items, totals),
//     because knowing both is what the invoice page needs.
// rateLimit bounds how fast one IP can enumerate phone numbers against it.
.get("/by-phone", rateLimit("orders-by-phone", 20, 5 * 60_000), async (c) => {
  const { phone, order: orderNumber } = c.req.query();

  if (!phone) {
    return c.json({ error: "Phone number is required" }, 400);
  }

  try {
    const ordersList = await db.query.orders.findMany({
      where: eq(orders.guestPhone, phone),
      // No `id`: the order id is the capability for GET /:id, so it must
      // never come back from a lookup keyed by something as guessable as a
      // phone number.
      columns: {
        orderNumber: true,
        status: true,
        paymentMethod: true,
        totalAmount: true,
        subtotal: true,
        deliveryCharge: true,
        shippingAddress: true,
        guestPhone: true,
        guestName: true,
        note: true,
        trackingNumber: true,
        createdAt: true,
      },
      with: {
        items: {
          columns: { id: true, quantity: true, price: true, size: true, color: true },
          with: {
            product: {
              columns: { id: true, name: true, images: true }
            }
          }
        },
      },
      orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    });

    // Phone alone: a summary of each order (what and where it stands).
    if (!orderNumber) {
      return c.json({ verified: false, orders: ordersList.map(toOrderSummary) });
    }

    // Phone + order number: that one order in full, as the invoice needs it.
    // Customers see the delivery charge they paid, never the admin's courier cost.
    const match = ordersList.find((o) => sameOrderNumber(o.orderNumber, orderNumber));
    if (!match) {
      return c.json({ verified: false, orders: [] });
    }
    const { deliveryCharge, ...rest } = match;
    return c.json({ verified: true, orders: [{ ...rest, shippingCost: deliveryCharge }] });
  } catch (error) {
    console.error("Failed to fetch orders by phone:", error);
    return c.json({ error: "Failed to fetch orders" }, 500);
  }
})

// Reachable without a session on purpose: the order-success page fetches it
// straight after checkout, when a guest has no account and nothing to
// authenticate with. The order id (a cuid) is the capability.
//
// What that cannot justify is the rest of the row. This used to return the
// order wholesale, including the fraud metadata captured at checkout —
// ipAddress, userAgent, deviceOs, browserName — plus the linked account's
// email and the internal timeline. None of it is shown to the customer, and
// order ids leak in ways the order itself does not: a Referer header, a
// support screenshot, a link pasted into a chat. A staff-only field should
// not ride along on a link a customer can forward.
//
// So the row is filtered by what the caller is allowed to see. Staff with
// orders:read get everything; anyone else gets the fields the success page
// and the invoice actually render.
.get("/:id", sessionMiddleware, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const isStaff = isAllowed(user, "orders", "read", ["MODERATOR"]);

  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        user: {
          columns: { id: true, name: true, email: true, phone: true }
        },
        items: {
          with: { product: true }
        },
        shippingMethod: true,
        payment: true,
        paymentLogs: {
          orderBy: (fields, { desc }) => [desc(fields.createdAt)]
        },
        OrderTimelineEvent: {
          orderBy: (fields, { asc }) => [asc(fields.createdAt)]
        },
      },
    });

    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }

    if (isStaff) {
      return c.json({ order });
    }

    return c.json({ order: toCustomerOrder(order) });
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return c.json({ error: "Failed to fetch order" }, 500);
  }
})

.get("/:id/payment-logs", sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!isAllowed(user, "orders", "read", ["MODERATOR"])) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const id = c.req.param("id");

  try {
    const logs = await db.query.paymentLogs.findMany({
      where: or(eq(paymentLogs.orderId, id), eq(paymentLogs.orderNumber, id)),
      orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    });
    return c.json({ logs });
  } catch (error) {
    console.error("Failed to fetch payment logs:", error);
    return c.json({ error: "Failed to fetch payment logs" }, 500);
  }
});

export default app;