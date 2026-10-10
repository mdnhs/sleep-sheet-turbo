// Order-side half of the bKash flow: reserving a payment for an order,
// finishing it once bKash confirms, and giving the stock back when the
// customer never pays.
//
// A bKash order is created up front (so the stock is reserved while the
// customer is on bKash's page) with paymentMethod "BKASH" and paymentStatus
// PENDING. It only counts as a real order once completeBkashOrder runs.
import { and, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { carts, cartItems, orders, orderTimelineEvents, products } from "@/db/schema";
import { createBkashPayment, getBkashConfig } from "@/lib/bkash";
import { matchesIssuedPayment, paymentIdRef } from "@/lib/bkash-reference";

export const BKASH_METHOD = "BKASH";

// How long an unpaid bKash order may hold stock before it is released.
const UNPAID_ORDER_TTL_MS = 45 * 60_000;

const trxIdRef = (trxID: string) => `bKash TrxID: ${trxID}`;

export { matchesIssuedPayment };

/**
 * Asks bKash for a payment for the order and remembers the paymentID on it,
 * so the callback can later prove the paymentID it is handed belongs to this
 * order and not some other one. Returns the bKash page to send the customer to.
 */
export async function startBkashPayment(
  order: { id: string; orderNumber: string; totalAmount: number; guestPhone: string | null },
  origin: string,
): Promise<string> {
  const config = await getBkashConfig();
  const payment = await createBkashPayment(config, {
    amount: order.totalAmount,
    invoiceNumber: order.orderNumber,
    callbackURL: `${origin}/api/bkash/callback/${order.id}`,
    payerReference: order.guestPhone || order.orderNumber,
  });

  await db
    .update(orders)
    .set({ reference: paymentIdRef(payment.paymentID), updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  return payment.bkashURL;
}

/**
 * Cancels an order that is still waiting for its bKash payment and restocks
 * it. The conditional update makes it safe to call twice (or to race the
 * success callback): only one caller can move the order out of PENDING.
 * The idempotency key is released so the customer can retry from checkout.
 */
export async function failBkashOrder(orderId: string, reason: string): Promise<boolean> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true },
  });
  if (!order || order.paymentMethod !== BKASH_METHOD) return false;

  const [updated] = await db
    .update(orders)
    .set({
      status: "CANCELLED",
      paymentStatus: "FAILED",
      cancellationReason: reason,
      idempotencyKey: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.paymentStatus, "PENDING"),
        ne(orders.status, "CANCELLED"),
      ),
    )
    .returning({ id: orders.id });
  if (!updated) return false;

  await db.transaction(async (tx) => {
    await tx.insert(orderTimelineEvents).values({
      orderId,
      status: "CANCELLED",
      message: `bKash payment not completed — ${reason}. Items restocked.`,
    });
    for (const item of order.items) {
      if (!item.productId) continue;
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${item.quantity}` })
        .where(eq(products.id, item.productId));
    }
  });
  return true;
}

/**
 * Marks the order paid. Returns the order (with item names, for the
 * notification) the first time only — null if it was already completed or is
 * no longer waiting for payment.
 */
export async function completeBkashOrder(orderId: string, trxID: string) {
  const [updated] = await db
    .update(orders)
    .set({ paymentStatus: "COMPLETED", reference: trxIdRef(trxID), updatedAt: new Date() })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.paymentMethod, BKASH_METHOD),
        eq(orders.paymentStatus, "PENDING"),
        ne(orders.status, "CANCELLED"),
      ),
    )
    .returning({ id: orders.id });
  if (!updated) return null;

  await db.insert(orderTimelineEvents).values({
    orderId,
    status: "PENDING",
    message: `Paid via bKash (TrxID ${trxID})`,
  });

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: { with: { product: { columns: { id: true, name: true, price: true } } } } },
  });
  if (!order) return null;

  // The server cart is only emptied now that the money is in — until then a
  // failed payment leaves the customer's cart intact for a retry.
  if (order.userId) {
    const cart = await db.query.carts.findFirst({ where: eq(carts.userId, order.userId) });
    if (cart) await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  }

  return order;
}

/** Releases stock held by bKash orders whose customer never came back. */
export async function expireStaleBkashOrders(): Promise<void> {
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.paymentMethod, BKASH_METHOD),
        eq(orders.paymentStatus, "PENDING"),
        ne(orders.status, "CANCELLED"),
        lt(orders.createdAt, new Date(Date.now() - UNPAID_ORDER_TTL_MS)),
      ),
    )
    .limit(20);

  for (const { id } of stale) {
    await failBkashOrder(id, "payment not completed in time");
  }
}

/** True for orders that exist but have not (yet) been paid via bKash. */
export const awaitingBkashPayment = and(
  eq(orders.paymentMethod, BKASH_METHOD),
  inArray(orders.paymentStatus, ["PENDING", "FAILED"]),
);
