import { Hono } from 'hono';
import { db } from '@/db';
import { orders, orderItems, payments, products, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { zValidator } from '@hono/zod-validator';
import { sessionMiddleware } from '@/lib/session-middleware';
import { can } from '@/lib/permissions';
import { getClientIp } from '@/lib/client-ip';
import { parseUserAgent } from '@/lib/user-agent-parser';
import { stockDecrementQuery, insufficientStockProductId, invalidateStockCache, soldOutProductIds } from '@/lib/stock';
import { setActivityMeta } from "@/features/activity/server/log-activity";
import { findOrCreateCustomerByPhone } from '@/lib/customers';
import { withOrderNumber } from '@/lib/order-number';
import { getSetting } from "@/lib/settings/read";
import { isUniqueViolation } from '@/lib/db-errors';
import cuid from 'cuid';

const app = new Hono()

.post('/', sessionMiddleware, zValidator('json', z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
  shippingType: z.enum(['showroom', 'online']).default('online'),
  paymentMethod: z.string().default('COD'),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1),
    price: z.number().min(0),
    costPrice: z.number().optional(),
    size: z.string().optional(),
    color: z.string().optional(),
  })).min(1, 'At least one item is required'),
  shippingCost: z.number().optional(),
  // One UUID per sale attempt, generated client-side (lib/pos-idempotency.ts)
  // — a double-click or slow-network re-click on "Complete Sale" reuses the
  // same key. Checkout has had this since launch; POS didn't (BAD-9, audit
  // 2026-09-21), so a repeat click created a second order, decremented stock
  // twice, and double-counted revenue.
  idempotencyKey: z.string().optional(),
})), async (c) => {
  const user = c.get('user');
  if (!user || !can(user, "pos", "write")) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  let productMap = new Map<string, typeof products.$inferSelect>();
  // Declared outside the try block (like productMap above) so the catch
  // handler below — which needs both to resolve a lost idempotency race —
  // can still read them even though they're only assigned once validation
  // and parsing succeed.
  let items: { productId: string; quantity: number; price: number; costPrice?: number; size?: string; color?: string }[] = [];
  let idempotencyKey: string | undefined;

  try {
    const body = c.req.valid('json');
    const { customerName, customerPhone, customerAddress, paymentMethod, reference, note, shippingType, shippingCost } = body;
    items = body.items;

    idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim() ? body.idempotencyKey.trim() : undefined;

    if (idempotencyKey) {
      const existing = await db.query.orders.findFirst({
        where: eq(orders.idempotencyKey, idempotencyKey),
      });
      if (existing) {
        return c.json({
          success: true,
          order: {
            id: existing.id,
            orderNumber: existing.orderNumber,
            totalAmount: existing.totalAmount,
            items: items.length,
          },
        }, 201);
      }
    }

    const productIds = items.map(i => i.productId);
    const productsList = await db.query.products.findMany({
      where: inArray(products.id, productIds),
    });
    productMap = new Map(productsList.map(p => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return c.json({ success: false, error: `Product not found: ${item.productId}` }, 400);
      }
      if (product.stock < item.quantity) {
        return c.json({ success: false, error: `Insufficient stock for ${product.name}` }, 400);
      }
    }

    const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const totalAmount = subtotal + (shippingCost || 0);

    let finalUserId: string | null = null;
    
    if (customerPhone) {
      // Shared with guest checkout — same match-or-create, and race-safe
      // against a concurrent sale to the same number (see lib/customers.ts).
      finalUserId = await findOrCreateCustomerByPhone({
        fullName: customerName,
        phone: customerPhone,
        address: customerAddress,
        emailDomain: "pos.local",
      });
    } else {
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const hashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-8), 10);
      const [newUser] = await db.insert(users).values({
        name: customerName,
        email: `guest_${randomSuffix}@pos.local`,
        password: hashedPassword,
        address: customerAddress || null,
      }).returning();
      finalUserId = newUser.id;
    }

    const userAgentHeader = c.req.header("user-agent") || null;
    const clientIp = getClientIp((name) => c.req.header(name));
    const parsedUa = parseUserAgent(userAgentHeader);

    // Order + its line items + the card payment record + the stock decrement
    // must all succeed or all fail together, so they run in one Postgres
    // transaction; stockDecrementQuery raises if any item is short on stock,
    // which rolls the whole thing back. That is also what makes the
    // order-number retry safe: a collision rolls everything back, so the retry
    // starts clean.
    const orderPrefix = await getSetting("pos_order_number_prefix");
    const { order, stockResult } = await withOrderNumber(orderPrefix, async (orderNumber) => {
      const orderId = cuid();
      setActivityMeta(c, { name: `#${orderNumber}` });

      return db.transaction(async (tx) => {
        const [order] = await tx.insert(orders).values({
          id: orderId,
          orderNumber,
          userId: finalUserId,
          guestName: customerName,
          guestPhone: customerPhone || null,
          subtotal,
          totalAmount,
          tax: 0,
          shippingCost: shippingCost || 0,
          deliveryCharge: shippingCost || 0,
          shippingAddress: customerAddress || (shippingType === 'showroom' ? 'POS - In-store pickup' : 'Online Delivery (POS)'),
          reference: reference || null,
          note: note || null,
          saleType: 'POS',
          paymentMethod,
          paymentStatus: paymentMethod === 'CARD' ? 'COMPLETED' : 'PENDING',
          status: shippingType === 'showroom' ? 'DELIVERED' : 'PENDING',
          confirmedAt: null,
          idempotencyKey: idempotencyKey ?? null,
          ipAddress: clientIp,
          deviceOs: parsedUa.os,
          browserName: parsedUa.browser,
          userAgent: userAgentHeader,
        }).returning();

        await tx.insert(orderItems).values(
          items.map(item => ({
            orderId,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            costPrice: item.costPrice || null,
            size: item.size || null,
            color: item.color || null,
          }))
        );

        // A card sale is paid at the counter, so it gets its payment row now.
        if (paymentMethod === 'CARD') {
          await tx.insert(payments).values({
            orderId,
            amount: totalAmount,
            method: 'CARD',
            status: 'COMPLETED',
          });
        }

        const stockResult = await tx.execute(stockDecrementQuery(items));
        return { order, stockResult };
      });
    });

    invalidateStockCache(soldOutProductIds(stockResult));

    return c.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        items: items.length,
      },
    }, 201);
  } catch (error) {
    // Lost a concurrent insert race on the same idempotency key: the winning
    // request already created the sale, so return that instead of erroring.
    if (idempotencyKey && isUniqueViolation(error)) {
      const existing = await db.query.orders.findFirst({
        where: eq(orders.idempotencyKey, idempotencyKey),
      });
      if (existing) {
        return c.json({
          success: true,
          order: {
            id: existing.id,
            orderNumber: existing.orderNumber,
            totalAmount: existing.totalAmount,
            items: items.length,
          },
        }, 201);
      }
    }
    const shortProductId = insufficientStockProductId(error);
    if (shortProductId) {
      const shortProduct = productMap.get(shortProductId);
      return c.json({ success: false, error: `Insufficient stock for ${shortProduct?.name ?? "an item"}` }, 400);
    }
    console.error('POS order error:', error);
    return c.json({ success: false, error: 'Failed to create POS order' }, 500);
  }
});

export default app;
