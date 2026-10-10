import { describe, expect, it } from "vitest";
import { db, type Transaction } from "@/db";
import { analyticsEvents, orderItems, orders, products } from "@/db/schema";
import { toRoute } from "../lib/route-pattern";
import type { AnalyticsEventType } from "../lib/types";
import { NONE } from "../lib/dimensions";
import { getKpis, getSeries } from "./queries";
import type { NewAnalyticsEvent } from "./store";

// Runs against the local Docker Postgres:
//   set -a && source .env && set +a && RUN_DB_TESTS=1 pnpm vitest run features/web-analytics/server/queries.db.test.ts
// Every test seeds inside a transaction that is rolled back, so nothing persists.
const RUN = process.env.RUN_DB_TESTS === "1";

class Rollback extends Error {}

async function withRollback(fn: (tx: Transaction) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
}

// 2001: far from any real data in a copy of production.
const DAY_RANGE = {
  start: new Date("2001-03-10T00:00:00+06:00"),
  end: new Date("2001-03-11T23:59:59.999+06:00"),
};

function ev(e: {
  type: AnalyticsEventType;
  session: string;
  visitor: string;
  at: string;
  path?: string;
  referrerHost?: string | null;
  productId?: string;
  orderId?: string;
}): NewAnalyticsEvent {
  const path = e.path ?? "/";
  return {
    type: e.type,
    sessionId: e.session,
    visitorId: e.visitor,
    ts: new Date(e.at),
    path,
    route: toRoute(path),
    referrerHost: e.referrerHost ?? null,
    productId: e.productId ?? null,
    orderId: e.orderId ?? null,
    country: "BD",
    device: "Mobile",
    browser: "Chrome 141",
    os: "Android",
  };
}

async function seedOrder(
  tx: Transaction,
  id: string,
  totalAmount: number,
  opts: { status?: "PENDING" | "CANCELLED" | "REFUNDED"; refundedAmount?: number } = {},
) {
  await tx.insert(orders).values({
    id,
    orderNumber: `WA-TEST-${id}`,
    totalAmount,
    subtotal: totalAmount,
    shippingCost: 0,
    deliveryCharge: 0,
    tax: 0,
    paymentMethod: "COD",
    shippingAddress: "analytics test",
    status: opts.status ?? "PENDING",
    refundedAmount: opts.refundedAmount ?? 0,
  });
}

/**
 * s1 (v1, YouTube, Mar 10): two pages, views and carts a product, then an order that gets cancelled.
 * s2 (v2, direct,  Mar 10): one page (a bounce).
 * s3 (v1, YouTube, Mar 11): one page, checkout, a valid order (1000, 200 refunded) recorded twice.
 */
async function seedScenario(tx: Transaction): Promise<{ productId: string }> {
  const [product] = await tx.select({ id: products.id }).from(products).limit(1);
  if (!product) throw new Error("The local database has no products; these tests join order_items to a real product.");

  await seedOrder(tx, "wa-ord-cancelled", 500, { status: "CANCELLED" });
  await seedOrder(tx, "wa-ord-1", 1000, { refundedAmount: 200 });
  await tx.insert(orderItems).values({ orderId: "wa-ord-1", productId: product.id, quantity: 1, price: 1000 });

  const yt = "youtube.com";
  await tx.insert(analyticsEvents).values([
    ev({ type: "page_view", session: "wa-s1", visitor: "wa-v1", at: "2001-03-10T10:00:00+06:00", path: "/", referrerHost: yt }),
    ev({ type: "page_view", session: "wa-s1", visitor: "wa-v1", at: "2001-03-10T10:05:00+06:00", path: "/shop/a", referrerHost: yt }),
    ev({ type: "product_view", session: "wa-s1", visitor: "wa-v1", at: "2001-03-10T10:05:01+06:00", path: "/shop/a", referrerHost: yt, productId: product.id }),
    ev({ type: "add_to_cart", session: "wa-s1", visitor: "wa-v1", at: "2001-03-10T10:06:00+06:00", path: "/shop/a", referrerHost: yt, productId: product.id }),
    ev({ type: "order_complete", session: "wa-s1", visitor: "wa-v1", at: "2001-03-10T10:10:00+06:00", path: "/shop/a", referrerHost: yt, orderId: "wa-ord-cancelled" }),
    ev({ type: "page_view", session: "wa-s2", visitor: "wa-v2", at: "2001-03-10T11:00:00+06:00", path: "/" }),
    ev({ type: "page_view", session: "wa-s3", visitor: "wa-v1", at: "2001-03-11T09:00:00+06:00", path: "/shop/a", referrerHost: yt }),
    ev({ type: "checkout_start", session: "wa-s3", visitor: "wa-v1", at: "2001-03-11T09:05:00+06:00", path: "/checkout", referrerHost: yt }),
    ev({ type: "order_complete", session: "wa-s3", visitor: "wa-v1", at: "2001-03-11T09:10:00+06:00", path: "/checkout", referrerHost: yt, orderId: "wa-ord-1" }),
    ev({ type: "order_complete", session: "wa-s3", visitor: "wa-v1", at: "2001-03-11T09:11:00+06:00", path: "/checkout", referrerHost: yt, orderId: "wa-ord-1" }),
  ]);
  return { productId: product.id };
}

describe.skipIf(!RUN)("web analytics queries (database)", () => {
  it("computes the KPIs, counting a duplicated order once and net of refunds", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      expect(await getKpis(tx, DAY_RANGE, {})).toEqual({
        visitors: 2,
        pageViews: 4,
        sessions: 3,
        bounced: 2,
        bounceRate: 2 / 3,
        orders: 1,
        revenue: 800,
        conversionRate: 0.5,
      });
    });
  });

  it("applies referrer filters, including (none) for direct traffic", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      expect(await getKpis(tx, DAY_RANGE, { referrer: "youtube.com" })).toMatchObject({
        visitors: 1,
        pageViews: 3,
        sessions: 2,
        bounced: 1,
        orders: 1,
        revenue: 800,
      });
      expect(await getKpis(tx, DAY_RANGE, { referrer: NONE })).toMatchObject({
        visitors: 1,
        pageViews: 1,
        orders: 0,
        revenue: 0,
      });
    });
  });

  it("counts orders from sessions that viewed a filtered page", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      expect(await getKpis(tx, DAY_RANGE, { path: "/shop/a" })).toMatchObject({
        visitors: 1,
        pageViews: 2,
        sessions: 2,
        bounced: 1,
        orders: 1,
      });
    });
  });

  it("builds zero-filled daily and hourly series in Dhaka time", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      const daily = await getSeries(tx, DAY_RANGE, {}, "day");
      expect(daily).toEqual([
        { bucket: "2001-03-10T00:00:00", visitors: 2, pageViews: 3, sessions: 2, bounced: 1, orders: 0, revenue: 0 },
        { bucket: "2001-03-11T00:00:00", visitors: 1, pageViews: 1, sessions: 1, bounced: 1, orders: 1, revenue: 800 },
      ]);

      const hourly = await getSeries(tx, DAY_RANGE, {}, "hour");
      expect(hourly).toHaveLength(48);
      expect(hourly[0].bucket).toBe("2001-03-10T00:00:00");
      expect(hourly[47].bucket).toBe("2001-03-11T23:00:00");
      expect(hourly.reduce((sum, p) => sum + p.pageViews, 0)).toBe(4);
    });
  });

  it("puts a 23:30 Dhaka visit on that Dhaka day, not the UTC one", async () => {
    await withRollback(async (tx) => {
      await tx.insert(analyticsEvents).values([
        ev({ type: "page_view", session: "wa-s4", visitor: "wa-v4", at: "2001-03-10T23:30:00+06:00" }),
        ev({ type: "page_view", session: "wa-s5", visitor: "wa-v5", at: "2001-03-11T00:30:00+06:00" }),
      ]);
      const daily = await getSeries(tx, DAY_RANGE, {}, "day");
      expect(daily.map((p) => [p.bucket, p.pageViews])).toEqual([
        ["2001-03-10T00:00:00", 1],
        ["2001-03-11T00:00:00", 1],
      ]);
    });
  });

  it("starts month buckets on the 1st, even after a 31-day month", async () => {
    await withRollback(async (tx) => {
      await tx.insert(analyticsEvents).values([
        ev({ type: "page_view", session: "wa-s6", visitor: "wa-v6", at: "2001-01-31T23:00:00+06:00" }),
        ev({ type: "page_view", session: "wa-s7", visitor: "wa-v7", at: "2001-02-01T01:00:00+06:00" }),
        ev({ type: "page_view", session: "wa-s8", visitor: "wa-v8", at: "2001-03-31T22:00:00+06:00" }),
      ]);
      const range = { start: new Date("2001-01-01T00:00:00+06:00"), end: new Date("2001-03-31T23:59:59.999+06:00") };
      const monthly = await getSeries(tx, range, {}, "month");
      expect(monthly.map((p) => [p.bucket, p.pageViews])).toEqual([
        ["2001-01-01T00:00:00", 1],
        ["2001-02-01T00:00:00", 1],
        ["2001-03-01T00:00:00", 1],
      ]);
    });
  });
});
