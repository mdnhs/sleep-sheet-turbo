import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
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
  refundBkashPayment,
  testBkashCredentials,
} from "@/lib/bkash";
import {
  BKASH_METHOD,
  completeBkashOrder,
  failBkashOrder,
  matchesIssuedPayment,
} from "@/lib/bkash-orders";
import { getRequestOrigin } from "@/lib/request-origin";
import { recordPaymentLog } from "@/lib/payment-logger";

const app = new Hono()

// bKash sends the customer's browser back here after the payment page
// (GET <callbackURL>?paymentID=…&status=success|failure|cancel).
// Checklist items 1, 2, 3:
// 1. For "failure"/"cancel" verification status in Create API callback, redirect user to payment failure page with payment failure message
// 2. Only for "success" verification status in Create API callback, Execute API should be called to execute a payment
// 3. From Execute API response [transactionStatus = "Completed"] is for successful payment and redirect users to success page.
//    Other than this, any other response is a failure case from Execute API and display proper errorMessageEn from the API response on failure page.
.get("/callback/:orderId", rateLimit("bkash-callback", 60, 60_000), async (c) => {
  const origin = getRequestOrigin(c);
  const orderId = c.req.param("orderId");
  const rawPaymentId = c.req.query("paymentID") || c.req.query("paymentId");
  const paymentID = rawPaymentId ? String(rawPaymentId).trim() : undefined;
  const status = (c.req.query("status") || "").trim().toLowerCase();

  const toFailure = (reason: "failed" | "cancelled", message?: string) => {
    const params = new URLSearchParams();
    params.set("status", reason === "cancelled" ? "cancel" : "failure");
    if (message) params.set("message", message);
    if (orderId) params.set("orderId", orderId);
    if (order?.orderNumber) params.set("orderNumber", order.orderNumber);
    const qs = params.toString();
    return c.redirect(origin ? `${origin}/payment-failure?${qs}` : `/payment-failure?${qs}`);
  };

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order || order.paymentMethod !== BKASH_METHOD) {
    console.error("[bKash Callback] Order not found or not bKash:", { orderId, method: order?.paymentMethod });
    return toFailure("failed", "Order not found");
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

  await recordPaymentLog({
    orderId: order.id,
    orderNumber: order.orderNumber,
    endpoint: "/callback",
    paymentId: paymentID,
    request: c.req.query(),
    statusMessage: status,
    isSuccess: status === "success",
  });

  // Callback fired twice (refresh, back button): already settled.
  if (order.paymentStatus === "COMPLETED") return toSuccess();
  if (order.status === "CANCELLED" || order.paymentStatus === "FAILED") {
    return toFailure("failed", "Order has already been cancelled or marked failed");
  }

  // Checklist item 1 & 2:
  // For "failure"/"cancel", redirect to payment failure page with payment failure message.
  // Execute API is ONLY called for "success" status.
  if (status !== "success") {
    console.warn(`[bKash Callback] Non-success status '${status}' for order ${order.orderNumber}`);
    if (!canSettleCallback(order.reference, paymentID)) {
      return toFailure("failed", "Invalid payment verification");
    }
    const cancelOrFail = status === "cancel" ? "cancelled" : "failed";
    const failureMsg =
      status === "cancel"
        ? "Payment was cancelled by user"
        : (c.req.query("statusMessage") || "bKash payment failed");
    await failBkashOrder(order.id, failureMsg);
    return toFailure(cancelOrFail, failureMsg);
  }

  // The paymentID must be the one we issued for THIS order — otherwise a
  // paymentID from a different order could be replayed here.
  if (!paymentID || !matchesIssuedPayment(order.reference, paymentID)) {
    console.error(`[bKash Callback] paymentID mismatch for order ${order.orderNumber}`, {
      expected: order.reference,
      received: paymentID,
    });
    return toFailure("failed", "Payment ID mismatch");
  }

  // Checklist items 2 & 3:
  // ONLY for "success" status, Execute API is called.
  // If transactionStatus === "Completed", redirect to success page.
  // Otherwise, treat as failure and display errorMessageEn on failure page.
  try {
    const config = await getBkashConfig();
    const result = await executeBkashPayment(config, paymentID);
    console.log(`[bKash Execute] Result for order ${order.orderNumber}:`, result);

    // Belt and braces: what bKash actually charged must match the order.
    if (result.invoiceNumber !== order.orderNumber || Math.abs(result.amount - order.totalAmount) > 0.01) {
      console.error("bKash result does not match order", order.orderNumber, {
        orderInvoice: order.orderNumber,
        resultInvoice: result.invoiceNumber,
        orderTotal: order.totalAmount,
        resultAmount: result.amount,
      });
      await failBkashOrder(order.id, "bKash payment did not match the order");
      return toFailure("failed", "bKash payment amount did not match the order");
    }

    await recordPaymentLog({
      orderId: order.id,
      orderNumber: order.orderNumber,
      endpoint: "/execute",
      paymentId: paymentID,
      trxId: result.trxID,
      amount: result.amount,
      response: result,
      statusCode: "0000",
      isSuccess: true,
    });

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
    const errorMessageEn =
      error instanceof BkashError
        ? error.message
        : "bKash payment execution failed";
    const statusCode = error instanceof BkashError ? error.statusCode : "ERROR";

    console.error(`[bKash Callback] Error executing payment for order ${order.orderNumber}:`, errorMessageEn);
    await recordPaymentLog({
      orderId: order.id,
      orderNumber: order.orderNumber,
      endpoint: "/execute",
      paymentId: paymentID,
      statusCode,
      statusMessage: errorMessageEn,
      isSuccess: false,
    });
    await failBkashOrder(order.id, errorMessageEn);
    return toFailure("failed", errorMessageEn);
  }
})

// Checklist item 5: Admin endpoint to perform/test refund using same stored id_token
.post(
  "/refund",
  sessionMiddleware,
  zValidator(
    "json",
    z.object({
      paymentID: z.string().min(1),
      trxID: z.string().min(1),
      amount: z.number().positive(),
      sku: z.string().optional(),
      reason: z.string().optional(),
      orderId: z.string().optional(),
    }),
  ),
  async (c) => {
    const user = c.get("user");
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { paymentID, trxID, amount, sku, reason, orderId } = c.req.valid("json");
    const config = await getBkashConfig();
    if (!isBkashConfigured(config)) {
      return c.json({ ok: false, message: "Save all four bKash credentials first." }, 400);
    }

    try {
      const refundResult = await refundBkashPayment(config, {
        paymentID,
        trxID,
        amount,
        sku,
        reason,
      });

      await recordPaymentLog({
        orderId,
        endpoint: "/payment/refund",
        paymentId: paymentID,
        trxId: refundResult.refundTrxID || trxID,
        amount,
        request: { paymentID, trxID, amount, sku, reason },
        response: refundResult,
        statusCode: refundResult.statusCode,
        statusMessage: refundResult.statusMessage,
        isSuccess: refundResult.statusCode === "0000",
      });

      return c.json({ ok: true, data: refundResult });
    } catch (error) {
      const message = error instanceof BkashError ? error.message : "Refund failed";
      await recordPaymentLog({
        orderId,
        endpoint: "/payment/refund",
        paymentId: paymentID,
        trxId: trxID,
        amount,
        request: { paymentID, trxID, amount, sku, reason },
        statusCode: error instanceof BkashError ? error.statusCode : "ERROR",
        statusMessage: message,
        isSuccess: false,
      });
      return c.json({ ok: false, error: message }, 400);
    }
  },
)

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

