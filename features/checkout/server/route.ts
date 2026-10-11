import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { calculateItemUnitPrice } from "@/lib/utils";
import { parseUserAgent } from "@/lib/user-agent-parser";
import { stockDecrementQuery, insufficientStockProductId, invalidateStockCache, soldOutProductIds } from "@/lib/stock";
import { getSetting } from "@/lib/settings-cache";
import { getSetting as getTypedSetting } from "@/lib/settings/read";
import { rateLimit } from "@/lib/rate-limit";
import cuid from "cuid";

import { batch, db } from "@/db";
import { carts, cartItems, products, orders, orderItems, shippingMethods } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { notifyNewOrder } from "@/lib/n8n-notify";
import { findOrCreateCustomerByPhone } from "@/lib/customers";
import { withOrderNumber } from "@/lib/order-number";
import { purchaseEventId } from "@/lib/meta-purchase-event";
import { deriveLandingSource } from "@/lib/traffic-source";
import { clientIpFromHeaders, isIpBlocked } from "@/lib/blocked-ip";
import { isUniqueViolation } from "@/lib/db-errors";
import { isBkashAvailable } from "@/lib/bkash";
import { expireStaleBkashOrders, failBkashOrder, startBkashPayment } from "@/lib/bkash-orders";
import { after } from "next/server";
import { analyticsIdSchema, recordOrderEvent } from "@/features/web-analytics/server/record-order-event";
import { markDraftConverted } from "@/features/web-analytics/server/drafts";
import { isValidBdMobile11 } from "@/features/fraud-checker/phone";

// Mirrors features/checkout/schema.ts (client-side form validation) so the
// server never trusts shippingInfo/paymentInfo/guestItems shape or content
// on faith — the client schema only ever ran in the browser.
const checkoutSchema = z.object({
  shippingInfo: z.object({
    fullName: z.string().trim().min(1),
    phone: z.string().trim().min(1).refine(isValidBdMobile11),
    email: z.string().trim().email().optional().or(z.literal("")),
    address: z.string().trim().min(1),
    shippingZone: z.enum(["inside_dhaka", "outside_dhaka"]),
    notes: z.string().optional(),
  }),
  paymentInfo: z.object({
    paymentMethod: z.enum(["card", "cod", "bkash"]),
    cardNumber: z.string().optional(),
    expirationDate: z.string().optional(),
    cvv: z.string().optional(),
    nameOnCard: z.string().optional(),
  }),
  guestItems: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1),
    size: z.string().optional(),
    color: z.string().optional(),
  })).optional(),
  idempotencyKey: z.string().optional(),
  // Meta click-id captured client-side (lib/meta-fbc.ts) — passed
  // through to the Purchase CAPI call and persisted on the order.
  fbc: z.string().optional(),
  // Attribution signals captured client-side at landing (see
  // lib/traffic-source.ts). Turned into `landingSource` below and persisted
  // alongside the raw values, so the orders dashboard can show "Facebook
  // Ad" / "YouTube Ad" / "Direct" without re-deriving it on every read.
  gclid: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  landingReferrer: z.string().optional(),
  // First-party analytics ids (features/web-analytics/lib/collector.ts), so
  // the order can be tied to the visit and campaign that produced it.
  analyticsVisitorId: analyticsIdSchema,
  analyticsSessionId: analyticsIdSchema,
});

async function getShippingCost(zone: string): Promise<number> {
  const key = zone === "outside_dhaka" ? "shipping_outside_dhaka" : "shipping_inside_dhaka";
  const value = await getSetting(key);
  return value !== undefined ? Number(value) : (zone === "outside_dhaka" ? 120 : 60);
}

async function isPaymentMethodEnabled(method: string): Promise<boolean> {
  // Card payments are hard-disabled here regardless of the
  // payment_method_card setting: there is no real payment gateway wired up,
  // so nothing should ever be able to create a "card" order. Re-enable only
  // once a PCI-compliant processor (e.g. SSLCommerz, bKash, Stripe) is
  // actually integrated — never re-add raw card storage.
  if (method === "card") return false;
  // bKash needs the admin to have switched it on AND saved every credential.
  if (method === "bkash") return isBkashAvailable();
  return (await getSetting("payment_method_cod", "true")) !== "false";
}

type CheckoutPaymentMethod = "card" | "cod" | "bkash";
const ORDER_PAYMENT_LABEL: Record<CheckoutPaymentMethod, string> = { card: "CARD", cod: "COD", bkash: "BKASH" };

// Sends the customer to bKash for an order that has just been reserved. If
// bKash can't be reached the order is cancelled and restocked straight away,
// so a gateway outage never leaves stock held by an order nobody can pay for.
async function bkashRedirect(
  order: { id: string; orderNumber: string; totalAmount: number; guestPhone: string | null },
  origin: string,
): Promise<{ bkashURL: string } | { error: string }> {
  try {
    return { bkashURL: await startBkashPayment(order, origin) };
  } catch (error) {
    console.error("Could not start bKash payment:", error);
    await failBkashOrder(order.id, "could not start bKash payment").catch(() => {});
    return { error: "bKash is unavailable right now. Please try again or choose another payment method." };
  }
}

const app = new Hono()

.post("/", rateLimit("checkout", 20, 5 * 60_000), sessionMiddleware, zValidator("json", checkoutSchema), async (c) => {
  const user = c.get("user");

  const { shippingInfo, paymentInfo, guestItems, idempotencyKey: rawKey, fbc, gclid, utmSource, utmMedium, utmCampaign, landingReferrer, analyticsVisitorId, analyticsSessionId } = c.req.valid("json");

  // Fraud control: an IP blocked from the order menu (features/blocked-ips)
  // is refused here, before any order row is written. This is the actual
  // enforcement point the blocked_ips table exists for — the admin UI and
  // CRUD API only manage the list; this is what makes the list matter.
  const requestIp = clientIpFromHeaders(c.req.raw.headers);
  if (await isIpBlocked(requestIp)) {
    return c.json({ message: "Order could not be placed" }, 403);
  }

  // One label, computed once, used by both order-creation branches below —
  // see lib/traffic-source.ts for what decides it.
  const landingSource = deriveLandingSource({ fbc, gclid, utmSource, utmMedium, referrer: landingReferrer });

  // Order-creation idempotency key: one UUID per checkout attempt, generated
  // client-side and stored in sessionStorage, so a double-click, a slow-network
  // re-click, or a back-then-resubmit reuses the SAME key. If an order already
  // exists for this key, return it instead of creating a second row. The unique
  // index on orders.idempotencyKey closes the remaining concurrent-burst race
  // below (the losing insert is caught via isUniqueViolation).
  const idempotencyKey: string | undefined =
    typeof rawKey === "string" && rawKey.trim() ? rawKey.trim() : undefined;

  const selectedMethod: CheckoutPaymentMethod =
    paymentInfo?.paymentMethod === "card" ? "card" : paymentInfo?.paymentMethod === "bkash" ? "bkash" : "cod";
  const isBkash = selectedMethod === "bkash";
  const proto = c.req.header("x-forwarded-proto") ?? "https";
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host");
  const origin = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : new URL(c.req.url).origin);

  if (idempotencyKey) {
    const existing = await db.query.orders.findFirst({
      where: eq(orders.idempotencyKey, idempotencyKey),
    });
    if (existing) {
      const unpaidBkash =
        existing.paymentMethod === "BKASH" &&
        existing.paymentStatus === "PENDING" &&
        existing.status !== "CANCELLED";
      if (unpaidBkash && isBkash) {
        // Back button / double submit while still unpaid: hand out a fresh
        // bKash payment for the same reserved order instead of a second one.
        const redirect = await bkashRedirect(existing, origin);
        if ("error" in redirect) return c.json({ message: redirect.error }, 502);
        return c.json({ message: "Redirecting to bKash", orderId: existing.id, bkashURL: redirect.bkashURL });
      }
      if (unpaidBkash) {
        // Switched to another method after starting a bKash checkout: drop
        // the unpaid reservation (this also frees the key) and place a new order.
        await failBkashOrder(existing.id, "customer switched payment method");
      } else {
        return c.json({
          message: "Order already placed",
          order: existing,
          orderId: existing.id,
        });
      }
    }
  }

  const methodEnabled = await isPaymentMethodEnabled(selectedMethod);
  if (!methodEnabled) {
    return c.json({ message: `Payment method "${selectedMethod}" is currently unavailable` }, 400);
  }
  // Opportunistic sweep: unpaid bKash orders older than the TTL give their
  // stock back, checked here because checkout is the only place that cares.
  if (isBkash) await expireStaleBkashOrders().catch((e) => console.error("bKash sweep failed:", e));

  const cartItemsForOrder: {
    productId: string;
    quantity: number;
    size?: string | null;
    color?: string | null;
    price: number;
  }[] = [];

  if (user) {
    const cart = await db.query.carts.findFirst({
      where: eq(carts.userId, user.id),
      with: { items: { with: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      return c.json({ message: "Cart is empty" }, 400);
    }

    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return c.json({ message: `Insufficient stock for ${item.product.name}` }, 400);
      }
      const displayPrice = calculateItemUnitPrice(
        item.color,
        item.product.price,
        item.product.variants as { name: string; price: number | null }[] | null,
        item.product.addOns as { name: string; price: number }[] | null
      );
      cartItemsForOrder.push({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        price: displayPrice,
      });
    }

    const subtotal = cartItemsForOrder.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const shippingCost = await getShippingCost(shippingInfo.shippingZone);
    const totalAmount = subtotal + shippingCost;

    const userAgentHeader = c.req.header("user-agent") || null;
    const clientIp = requestIp;
    const parsedUa = parseUserAgent(userAgentHeader);

    try {
      // Order + its line items + the stock decrement + clearing the cart must
      // all succeed or all fail together — otherwise a mid-way failure can
      // leave an order with no items, or decremented stock with no order.
      // batch() runs every statement in one Postgres transaction;
      // stockDecrementQuery raises if any item is short on stock, which rolls
      // the whole batch back. That is also what makes the
      // order-number retry below safe: a collision rolls the whole thing back.
      const orderPrefix = await getTypedSetting("order_number_prefix");
      const { order, orderNumber, stockResult } = await withOrderNumber(orderPrefix, async (orderNumber) => {
        const orderId = cuid();
        const [[order], , stockResult] = await batch((tx) => [
          tx.insert(orders).values({
            id: orderId,
            orderNumber,
            userId: user.id,
            guestName: shippingInfo.fullName,
            guestPhone: shippingInfo.phone,
            guestEmail: shippingInfo.email || null,
            subtotal,
            totalAmount,
            tax: 0,
            shippingCost,
            deliveryCharge: shippingCost,
            shippingAddress: shippingInfo.address,
            paymentMethod: orderPaymentMethod,
            saleType: 'WEBSITE',
            note: shippingInfo.notes || null,
            idempotencyKey: idempotencyKey ?? null,
            ipAddress: clientIp,
            deviceOs: parsedUa.os,
            browserName: parsedUa.browser,
            userAgent: userAgentHeader,
            fbc: fbc || null,
            gclid: gclid || null,
            utmSource: utmSource || null,
            utmMedium: utmMedium || null,
            utmCampaign: utmCampaign || null,
            landingReferrer: landingReferrer || null,
            landingSource,
          }).returning(),
          tx.insert(orderItems).values(
            cartItemsForOrder.map((item) => ({
              orderId,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              size: item.size || null,
              color: item.color || null,
            }))
          ),
          tx.execute(stockDecrementQuery(cartItemsForOrder)),
          // A bKash order keeps the cart until the payment is confirmed
          // (completeBkashOrder), so a failed payment can simply be retried.
          tx.delete(cartItems).where(isBkash ? sql`false` : eq(cartItems.cartId, cart.id)),
        ]);
        return { order, orderNumber, stockResult };
      });

      const createdOrder = order;
      invalidateStockCache(soldOutProductIds(stockResult));

      // Ties this order to the visit that produced it. Runs after the
      // response and never fails the checkout. bKash orders are recorded now
      // too: an unpaid one ends up CANCELLED, which the dashboard excludes.
      const analyticsHeaders = c.req.raw.headers;
      after(() =>
        recordOrderEvent({
          orderId: order.id,
          value: totalAmount,
          visitorId: analyticsVisitorId,
          sessionId: analyticsSessionId,
          headers: analyticsHeaders,
        }),
      );
      after(() => markDraftConverted({ orderId: order.id, sessionId: analyticsSessionId, phone: shippingInfo.phone }));

      // bKash: the order is only reserved. The customer pays on bKash's page
      // and the callback (features/bkash) confirms it, notifies n8n and
      // retires the cart — none of which should happen for an unpaid order.
      if (isBkash) {
        const redirect = await bkashRedirect(order, origin);
        if ("error" in redirect) return c.json({ message: redirect.error }, 502);
        return c.json({ message: "Redirecting to bKash", orderId: order.id, bkashURL: redirect.bkashURL });
      }

      notifyNewOrder({
        orderId: order.id,
        orderNumber,
        customerName: shippingInfo.fullName,
        customerPhone: shippingInfo.phone,
        address: shippingInfo.address,
        paymentMethod: orderPaymentMethod,
        totalAmount,
        items: cart.items.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          price: i.product.price,
        })),
      });

      // Server-side Meta Purchase (CAPI) is deferred until order confirmation
      // (status moves to PROCESSING/SHIPPED or Steadfast booking) to prevent
      // fake/spam orders from polluting Meta Ads optimization.

      return c.json({
        message: "Order placed successfully",
        order: createdOrder,
        orderId: order.id,
        purchase: {
          value: totalAmount,
          currency: "BDT",
          orderId: order.id,
          orderNumber,
          eventId: purchaseEventId(orderNumber || order.id),
          contents: cartItemsForOrder.map((i) => ({
            id: i.productId,
            quantity: i.quantity,
            item_price: i.price,
          })),
          numItems: cartItemsForOrder.reduce((s, i) => s + i.quantity, 0),
        },
      });
    } catch (error) {
      // Lost a concurrent insert race on the same idempotency key: the winning
      // request already created the order, so return that instead of erroring.
      if (idempotencyKey && isUniqueViolation(error)) {
        const existing = await db.query.orders.findFirst({
          where: eq(orders.idempotencyKey, idempotencyKey),
          with: {
            items: true,
          },
        });
        if (existing) {
          return c.json({
            message: "Order already placed",
            order: existing,
            orderId: existing.id,
            purchase: {
              value: existing.totalAmount,
              currency: "BDT",
              orderId: existing.id,
              orderNumber: existing.orderNumber,
              eventId: purchaseEventId(existing.orderNumber || existing.id),
              contents: (existing.items || []).map((i) => ({
                id: i.productId,
                quantity: i.quantity,
                item_price: i.price,
              })),
              numItems: (existing.items || []).reduce((s, i) => s + i.quantity, 0),
            },
          });
        }
      }
      const shortProductId = insufficientStockProductId(error);
      if (shortProductId) {
        const shortItem = cart.items.find((i) => i.productId === shortProductId);
        return c.json({ message: `Insufficient stock for ${shortItem?.product.name ?? "an item"}` }, 400);
      }
      console.error("Error placing order:", error);
      return c.json({ message: "Error placing order" }, 500);
    }
  }

  // Guest checkout
  if (!guestItems || guestItems.length === 0) {
    return c.json({ message: "Cart is empty" }, 400);
  }

  const productIds: string[] = guestItems.map((i: { productId: string }) => i.productId);
  const productsList = await db.query.products.findMany({
    where: inArray(products.id, productIds),
  });

  const productMap = new Map(productsList.map((p) => [p.id, p]));

  for (const item of guestItems) {
    const product = productMap.get(item.productId);
    if (!product) return c.json({ message: `Product not found` }, 400);
    if (product.stock < item.quantity) {
      return c.json({ message: `Insufficient stock for ${product.name}` }, 400);
    }
    const displayPrice = calculateItemUnitPrice(
      item.color,
      product.price,
      product.variants as { name: string; price: number | null }[] | null,
      product.addOns as { name: string; price: number }[] | null
    );
    cartItemsForOrder.push({
      productId: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      price: displayPrice,
    });
  }

  const subtotal = cartItemsForOrder.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const shippingCost = await getShippingCost(shippingInfo.shippingZone);
  const totalAmount = subtotal + shippingCost;

  const userAgentHeader = c.req.header("user-agent") || null;
  const clientIp = requestIp;
  const parsedUa = parseUserAgent(userAgentHeader);

  try {
    const guestUserId = await findOrCreateCustomerByPhone({
      fullName: shippingInfo.fullName,
      phone: shippingInfo.phone,
      email: shippingInfo.email,
      address: shippingInfo.address,
      emailDomain: "guest.local",
    });

    const orderPrefix = await getTypedSetting("order_number_prefix");
    const { order, orderNumber, stockResult } = await withOrderNumber(orderPrefix, async (orderNumber) => {
      const orderId = cuid();
      const [[order], , stockResult] = await batch((tx) => [
        tx.insert(orders).values({
          id: orderId,
          orderNumber,
          userId: guestUserId,
          guestName: shippingInfo.fullName,
          guestPhone: shippingInfo.phone,
          guestEmail: shippingInfo.email || null,
          subtotal,
          totalAmount,
          tax: 0,
          shippingCost,
          deliveryCharge: shippingCost,
          shippingAddress: shippingInfo.address,
          paymentMethod: orderPaymentMethod,
          saleType: 'WEBSITE',
          note: shippingInfo.notes || null,
          idempotencyKey: idempotencyKey ?? null,
          ipAddress: clientIp,
          deviceOs: parsedUa.os,
          browserName: parsedUa.browser,
          userAgent: userAgentHeader,
          fbc: fbc || null,
          gclid: gclid || null,
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null,
          landingReferrer: landingReferrer || null,
          landingSource,
        }).returning(),
        tx.insert(orderItems).values(
          cartItemsForOrder.map((item) => ({
            orderId,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            size: item.size ?? null,
            color: item.color ?? null,
          }))
        ),
        tx.execute(stockDecrementQuery(cartItemsForOrder)),
      ]);
      return { order, orderNumber, stockResult };
    });

    const guestOrderId = order.id;
    invalidateStockCache(soldOutProductIds(stockResult));

    // See the logged-in branch.
    const analyticsHeaders = c.req.raw.headers;
    after(() =>
      recordOrderEvent({
        orderId: order.id,
        value: totalAmount,
        visitorId: analyticsVisitorId,
        sessionId: analyticsSessionId,
        headers: analyticsHeaders,
      }),
    );
    after(() => markDraftConverted({ orderId: order.id, sessionId: analyticsSessionId, phone: shippingInfo.phone }));

    // See the logged-in branch: bKash orders wait for the payment callback.
    if (isBkash) {
      const redirect = await bkashRedirect(order, origin);
      if ("error" in redirect) return c.json({ message: redirect.error }, 502);
      return c.json({ message: "Redirecting to bKash", orderId: order.id, bkashURL: redirect.bkashURL });
    }

    notifyNewOrder({
      orderId: order.id,
      orderNumber,
      customerName: shippingInfo.fullName,
      customerPhone: shippingInfo.phone,
      address: shippingInfo.address,
      paymentMethod: orderPaymentMethod,
      totalAmount,
      items: guestItems.map((i: { productId: string; quantity: number }) => {
        const product = productMap.get(i.productId);
        return {
          productId: i.productId,
          name: product?.name ?? "Unknown",
          quantity: i.quantity,
          price: product?.price ?? 0,
        };
      }),
    });

    // Server-side Meta Purchase (CAPI) is deferred until order confirmation
    // (status moves to PROCESSING/SHIPPED or Steadfast booking) to prevent
    // fake/spam orders from polluting Meta Ads optimization.

    return c.json({
      message: "Order placed successfully",
      orderId: guestOrderId,
      purchase: {
        value: totalAmount,
        currency: "BDT",
        orderId: order.id,
        orderNumber,
        eventId: purchaseEventId(orderNumber || order.id),
        contents: cartItemsForOrder.map((i) => ({
          id: i.productId,
          quantity: i.quantity,
          item_price: i.price,
        })),
        numItems: cartItemsForOrder.reduce((s, i) => s + i.quantity, 0),
      },
    });
  } catch (error) {
    // Lost a concurrent insert race on the same idempotency key: the winning
    // request already created the order, so return that instead of erroring.
    if (idempotencyKey && isUniqueViolation(error)) {
      const existing = await db.query.orders.findFirst({
        where: eq(orders.idempotencyKey, idempotencyKey),
        with: {
          items: true,
        },
      });
      if (existing) {
        return c.json({
          message: "Order already placed",
          order: existing,
          orderId: existing.id,
          purchase: {
            value: existing.totalAmount,
            currency: "BDT",
            orderId: existing.id,
            eventId: purchaseEventId(existing.id),
            contents: (existing.items || []).map((i) => ({
              id: i.productId,
              quantity: i.quantity,
              item_price: i.price,
            })),
            numItems: (existing.items || []).reduce((s, i) => s + i.quantity, 0),
          },
        });
      }
    }
    const shortProductId = insufficientStockProductId(error);
    if (shortProductId) {
      const shortItem = productMap.get(shortProductId);
      return c.json({ message: `Insufficient stock for ${shortItem?.name ?? "an item"}` }, 400);
    }
    console.error("Error placing guest order:", error);
    return c.json({ message: "Error placing order" }, 500);
  }
})

.get("/shipping-methods", async (c) => {
  try {
    const shippingMethodsList = await db.query.shippingMethods.findMany({
      where: eq(shippingMethods.active, true),
      orderBy: (fields, { asc }) => [asc(fields.cost)],
    });

    return c.json({ shippingMethods: shippingMethodsList });
  } catch (error) {
    console.error("Error fetching shipping methods:", error);
    return c.json({ error: "Failed to fetch shipping methods" }, 500);
  }
});

export default app;
