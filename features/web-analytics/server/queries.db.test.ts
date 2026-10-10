import { describe, expect, it } from "vitest";
import { db, type Transaction } from "@/db";
import { analyticsEvents, orderItems, orders, products } from "@/db/schema";
import { toRoute } from "../lib/route-pattern";
import type { AnalyticsEventType } from "../lib/types";
import { NONE } from "../lib/dimensions";
import { getBreakdown, getFunnel, getKpis, getLive, getProducts, getSeries } from "./queries";
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
  label?: string;
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
    label: e.label ?? null,
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
    ev({ type: "checkout_field", session: "wa-s3", visitor: "wa-v1", at: "2001-03-11T09:06:00+06:00", path: "/checkout", referrerHost: yt, label: "fullName" }),
    ev({ type: "checkout_field", session: "wa-s3", visitor: "wa-v1", at: "2001-03-11T09:07:00+06:00", path: "/checkout", referrerHost: yt, label: "phone" }),
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

  it("breaks visitors, orders and revenue down by referrer", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      expect(await getBreakdown(tx, DAY_RANGE, {}, "referrer", 10)).toEqual([
        { key: "youtube.com", visitors: 1, orders: 1, revenue: 800 },
        { key: null, visitors: 1, orders: 0, revenue: 0 },
      ]);
    });
  });

  it("breaks visitors down by page", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      const rows = await getBreakdown(tx, DAY_RANGE, {}, "path", 10);
      expect(rows.map((r) => [r.key, r.visitors])).toEqual([
        ["/", 2],
        ["/shop/a", 1],
      ]);
    });
  });

  it("pages a breakdown with limit and offset", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      const keys = async (offset: number) =>
        (await getBreakdown(tx, DAY_RANGE, {}, "path", 1, offset)).map((r) => r.key);
      expect(await keys(0)).toEqual(["/"]);
      expect(await keys(1)).toEqual(["/shop/a"]);
      expect(await keys(2)).toEqual([]);
    });
  });

  it("builds the funnel, leaving out the cancelled order", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      expect(await getFunnel(tx, DAY_RANGE, {})).toEqual({
        visited: 3,
        viewedProduct: 1,
        addedToCart: 1,
        startedCheckout: 1,
        enteredName: 1,
        enteredPhone: 1,
        enteredAddress: 0,
        ordered: 1,
      });
      expect(await getFunnel(tx, DAY_RANGE, { referrer: NONE })).toEqual({
        visited: 1,
        viewedProduct: 0,
        addedToCart: 0,
        startedCheckout: 0,
        enteredName: 0,
        enteredPhone: 0,
        enteredAddress: 0,
        ordered: 0,
      });
    });
  });

  it("lists products with views, carts and orders", async () => {
    await withRollback(async (tx) => {
      const { productId } = await seedScenario(tx);
      const rows = await getProducts(tx, DAY_RANGE, {}, 20);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ productId, views: 1, addedToCart: 1, orders: 1 });
      expect(typeof rows[0].name).toBe("string");
    });
  });

  it("reports who is online and the page each visitor is on now", async () => {
    await withRollback(async (tx) => {
      const before = await getLive(tx);
      const now = Date.now();
      await tx.insert(analyticsEvents).values([
        ev({ type: "page_view", session: "wa-l1", visitor: "wa-live-1", at: new Date(now).toISOString(), path: "/wa-live-a" }),
        ev({ type: "page_view", session: "wa-l2", visitor: "wa-live-2", at: new Date(now - 60_000).toISOString(), path: "/wa-live-c" }),
        ev({ type: "page_view", session: "wa-l2", visitor: "wa-live-2", at: new Date(now).toISOString(), path: "/wa-live-b" }),
        ev({ type: "page_view", session: "wa-l3", visitor: "wa-live-3", at: new Date(now - 10 * 60_000).toISOString(), path: "/wa-live-old" }),
      ]);
      const live = await getLive(tx);
      expect(live.online - before.online).toBe(2);
      expect(live.pages).toEqual(
        expect.arrayContaining([
          { path: "/wa-live-a", visitors: 1 },
          { path: "/wa-live-b", visitors: 1 },
        ]),
      );
      expect(live.pages.map((p) => p.path)).not.toContain("/wa-live-c");
      expect(live.pages.map((p) => p.path)).not.toContain("/wa-live-old");
    });
  });
});
