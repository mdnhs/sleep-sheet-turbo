import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { sessionMiddleware } from "@/lib/session-middleware";
import { rateLimit } from "@/lib/rate-limit";
import { notifyNewOrder } from "@/lib/n8n-notify";
import { canSettleCallback } from "@/lib/bkash-reference";
import {
  BkashError,
  executeBkashPayment,
  getBkashConfig,
  isBkashConfigured,
  testBkashCredentials,
} from "@/lib/bkash";
import {
  BKASH_METHOD,
  completeBkashOrder,
  failBkashOrder,
  matchesIssuedPayment,
} from "@/lib/bkash-orders";
import { getRequestOrigin } from "@/lib/request-origin";

const app = new Hono()

// bKash sends the customer's browser back here after the payment page
// (GET <callbackURL>?paymentID=…&status=success|failure|cancel). Nothing in
// the query string is trusted: the money is only counted once bKash itself
// confirms the execute call, for the paymentID we issued to this order.
.get("/callback/:orderId", rateLimit("bkash-callback", 60, 60_000), async (c) => {
  const origin = getRequestOrigin(c);
  const orderId = c.req.param("orderId");
  const rawPaymentId = c.req.query("paymentID") || c.req.query("paymentId");
  const paymentID = rawPaymentId ? String(rawPaymentId).trim() : undefined;
  const status = (c.req.query("status") || "").trim().toLowerCase();

  const toCheckout = (reason: "failed" | "cancelled") =>
    c.redirect(origin ? `${origin}/checkout?payment=${reason}` : `/checkout?payment=${reason}`);

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order || order.paymentMethod !== BKASH_METHOD) {
    console.error("[bKash Callback] Order not found or not bKash:", { orderId, method: order?.paymentMethod });
    return toCheckout("failed");
  }

  const toSuccess = () =>
    c.redirect(
      origin
        ? `${origin}/order-success?orderId=${order.id}&phone=${encodeURIComponent(order.guestPhone ?? "")}`
        : `/order-success?orderId=${order.id}&phone=${encodeURIComponent(order.guestPhone ?? "")}`,
    );

  console.log(`[bKash Callback Received] Order: ${order.orderNumber} (ID: ${orderId}), Params:`, {
    paymentID,
    status,
    rawQuery: c.req.query(),
  });

  // Callback fired twice (refresh, back button): already settled.
  if (order.paymentStatus === "COMPLETED") return toSuccess();
  if (order.status === "CANCELLED" || order.paymentStatus === "FAILED") return toCheckout("failed");

  if (status !== "success") {
    console.warn(`[bKash Callback] Non-success status '${status}' for order ${order.orderNumber}`);
    // Only the customer coming back from bKash's page for this order carries
    // the paymentID we issued. Without it, leave the order alone; if it's
    // never paid, the stale-order sweep releases the stock.
    if (!canSettleCallback(order.reference, paymentID)) return toCheckout("failed");
    await failBkashOrder(order.id, status === "cancel" ? "customer cancelled" : "payment failed");
    return toCheckout(status === "cancel" ? "cancelled" : "failed");
  }

  // The paymentID must be the one we issued for THIS order — otherwise a
  // paymentID from a different (e.g. cheaper) order could be replayed here.
  if (!paymentID || !matchesIssuedPayment(order.reference, paymentID)) {
    console.error(`[bKash Callback] paymentID mismatch for order ${order.orderNumber}`, {
      expected: order.reference,
      received: paymentID,
    });
    return toCheckout("failed");
  }

  try {
    const config = await getBkashConfig();
    const result = await executeBkashPayment(config, paymentID);
    console.log(`[bKash Execute] Result for order ${order.orderNumber}:`, result);

    if (!result) {
      console.error(`[bKash Execute] bKash did not confirm payment for order ${order.orderNumber}`);
      await failBkashOrder(order.id, "bKash did not confirm the payment");
      return toCheckout("failed");
    }

    // Belt and braces: what bKash actually charged must match the order.
    if (result.invoiceNumber !== order.orderNumber || Math.abs(result.amount - order.totalAmount) > 0.01) {
      console.error("bKash result does not match order", order.orderNumber, {
        orderInvoice: order.orderNumber,
        resultInvoice: result.invoiceNumber,
        orderTotal: order.totalAmount,
        resultAmount: result.amount,
      });
      await failBkashOrder(order.id, "bKash payment did not match the order");
      return toCheckout("failed");
    }

    const paid = await completeBkashOrder(order.id, result.trxID);
    if (paid) {
      console.log(`[bKash Callback Settled] Order ${order.orderNumber} successfully marked COMPLETED with TrxID: ${result.trxID}`);
      notifyNewOrder({
        orderId: paid.id,
        orderNumber: paid.orderNumber,
        customerName: paid.guestName ?? "",
        customerPhone: paid.guestPhone ?? "",
        address: paid.shippingAddress,
        paymentMethod: BKASH_METHOD,
        totalAmount: paid.totalAmount,
        items: paid.items.map((i) => ({
          productId: i.productId ?? "",
          name: i.product?.name ?? "Unknown",
          quantity: i.quantity,
          price: i.product?.price ?? i.price,
        })),
      });
    }
    return toSuccess();
  } catch (error) {
    // bKash unreachable / unexpected: leave the order PENDING rather than
    // cancelling a payment that may have gone through. The customer can
    // retry, and the stale-order sweep releases the stock if they never do.
    console.error(`[bKash Callback] Error executing payment for order ${order.orderNumber}:`, error);
    return toCheckout("failed");
  }
})

// Admin-only: checks the saved credentials by requesting a token.
.post("/test", sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || user.role !== "ADMIN") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const config = await getBkashConfig();
  if (!isBkashConfigured(config)) {
    return c.json({ ok: false, message: "Save all four bKash credentials first." }, 400);
  }

  try {
    await testBkashCredentials(config);
    return c.json({ ok: true, message: `Connected to bKash (${config.mode}).` });
  } catch (error) {
    const message = error instanceof BkashError ? error.message : "Could not verify credentials";
    return c.json({ ok: false, message }, 400);
  }
});

export default app;
