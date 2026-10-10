import { Hono } from "hono";
import { sessionMiddleware } from "@/lib/session-middleware";
import { can, isAllowed } from "@/lib/permissions";
import { db } from "@/db";
import { orders, orderItems, products, carts, wishlistItems, expenses, users } from "@/db/schema";
import { eq, ne, and, gte, lte, asc, desc, sum, count, isNotNull, sql } from "drizzle-orm";
import { getPreviousRange, getStartDate, getTrendBucketUnit, resolveDateRange } from "@/lib/date-utils";

/**
 * Who may read store-wide analytics.
 *
 * Every handler in this file used to check only "is anyone logged in". Signup
 * is public and self-serve, and a new account gets role USER with no
 * permissions — so any of the store's registered customers could call these
 * endpoints and read revenue, customer lifetime value, cohort retention,
 * spending segments, stock levels and the most recent orders with the
 * customers' names on them. Every other dashboard route in the app already
 * gated on a permission; this one was simply missed.
 *
 * Accepts `reports:read` as well as `dashboard:read` on purpose. The two are
 * separate modules, and a role can legitimately carry either: the store's own
 * "Owner" role holds reports:read without dashboard:read, and requiring only
 * the latter would have locked it out of the dashboard it is named for.
 * ADMIN passes via can(); MODERATOR is bypassed the same way the orders
 * routes bypass it.
 */
function canViewAnalytics(user: Parameters<typeof can>[0]): boolean {
  return (
    isAllowed(user, "dashboard", "read", ["MODERATOR"]) ||
    can(user, "reports", "read")
  );
}

const app = new Hono()

// Sales Overview
.get("/sales-overview", sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const { period = "month", from, to } = c.req.query();
    const { startDate, endDate } = resolveDateRange(period, from, to);
    const { startDate: prevStart, endDate: prevEnd } = getPreviousRange(startDate, endDate);
    // Daily buckets read badly over a long range; roll up to a coarser unit
    const trendUnit = getTrendBucketUnit(startDate, endDate);

    const validOrders = and(ne(orders.status, "CANCELLED"), ne(orders.status, "REFUNDED"));
    const inRange = (start: Date, end: Date) =>
      and(validOrders, gte(orders.createdAt, start), lte(orders.createdAt, end));

    const orderStats = (start: Date, end: Date) =>
      db.select({
          revenue: sum(sql<number>`${orders.totalAmount} - COALESCE(${orders.refundedAmount}, 0)`),
          // subtotal, not totalAmount — totalAmount already has shippingCost
          // folded in, which would cancel out the shippingCost subtraction
          // in the profit calc below. Kept separate so `revenue` (used for
          // AOV and the revenue tile) still reflects the full amount charged.
          subtotalRevenue: sum(sql<number>`${orders.subtotal} - COALESCE(${orders.refundedAmount}, 0)`),
          shipping: sum(orders.shippingCost),
          orders: count(),
        })
        .from(orders)
        .where(inRange(start, end));

    const costStats = (start: Date, end: Date) =>
      db.select({
          sum: sql<number>`SUM(${orderItems.quantity} * COALESCE(${orderItems.costPrice}, 0))`
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(inRange(start, end));

    const expenseStats = (start: Date, end: Date) =>
      db.select({ sum: sum(expenses.amount) })
        .from(expenses)
        .where(and(gte(expenses.date, start), lte(expenses.date, end)));

    const cancelledStats = (start: Date, end: Date) =>
      db.select({
          count: count(),
          amount: sum(orders.totalAmount),
        })
        .from(orders)
        .where(and(eq(orders.status, "CANCELLED"), gte(orders.createdAt, start), lte(orders.createdAt, end)));

    const returnedStats = (start: Date, end: Date) =>
      db.select({
          count: count(),
          amount: sum(sql<number>`COALESCE(${orders.refundedAmount}, ${orders.totalAmount})`),
        })
        .from(orders)
        .where(and(sql`(${orders.status} = 'REFUNDED' OR (${orders.refundedAmount} IS NOT NULL AND ${orders.refundedAmount} > 0))`, gte(orders.createdAt, start), lte(orders.createdAt, end)));

    const pageRef = sql<string>`
      CASE
        WHEN ${orders.saleType} = 'POS' THEN
          CASE
            WHEN ${orders.reference} IS NULL OR TRIM(${orders.reference}) = '' THEN 'Sleep Sheet (POS)'
            WHEN TRIM(${orders.reference}) ILIKE '%(pos)' THEN TRIM(${orders.reference})
            ELSE TRIM(${orders.reference}) || ' (POS)'
          END
        ELSE
          'Website'
      END
    `;

    const channelStats = (start: Date, end: Date) =>
      db.select({
          channel: pageRef,
          orders: count(),
          revenue: sum(sql<number>`${orders.totalAmount} - COALESCE(${orders.refundedAmount}, 0)`),
        })
        .from(orders)
        .where(inRange(start, end))
        .groupBy(pageRef);

    const [
      currRes, prevRes, salesTrend, currExpenses, prevExpenses, currCost, prevCost,
      currCancelled, prevCancelled, currReturned, prevReturned,
      currChannelRes, prevChannelRes
    ] =
      await Promise.all([
        orderStats(startDate, endDate),
        orderStats(prevStart, prevEnd),
        db.select({
            // trendUnit as a bound parameter (not sql.raw string interpolation)
            // — DATE_TRUNC accepts its unit argument as a normal text value.
            // GROUP BY / ORDER BY reference the select list by ordinal (1)
            // rather than repeating the DATE_TRUNC expression: repeating it
            // binds trendUnit as a SEPARATE parameter each time, and Postgres
            // won't recognize two different placeholders as the same grouped
            // expression even though they carry the same value at bind time
            // — that mismatch is exactly what caused "column must appear in
            // the GROUP BY clause" here. Ordinal position sidesteps that.
            bucket: sql<string>`DATE_TRUNC(${trendUnit}, ${orders.createdAt})`,
            amount: sum(orders.totalAmount),
          })
          .from(orders)
          .where(inRange(startDate, endDate))
          .groupBy(sql`1`)
          .orderBy(asc(sql`1`)),
        expenseStats(startDate, endDate),
        expenseStats(prevStart, prevEnd),
        costStats(startDate, endDate),
        costStats(prevStart, prevEnd),
        cancelledStats(startDate, endDate),
        cancelledStats(prevStart, prevEnd),
        returnedStats(startDate, endDate),
        returnedStats(prevStart, prevEnd),
        channelStats(startDate, endDate),
        channelStats(prevStart, prevEnd),
      ]);

    const totalRevenue = Number(currRes[0]?.revenue || 0);
    const subtotalRevenue = Number(currRes[0]?.subtotalRevenue || 0);
    const totalShipping = Number(currRes[0]?.shipping || 0);
    const totalOrders = Number(currRes[0]?.orders || 0);
    const totalExpenses = Number(currExpenses[0]?.sum || 0);
    const totalCost = Number(currCost[0]?.sum || 0);
    const netProfit = totalRevenue - totalCost - totalShipping - totalExpenses;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const channels = currChannelRes.map((ch) => ({
      channel: ch.channel,
      orders: Number(ch.orders || 0),
      revenue: Number(ch.revenue || 0),
    })).sort((a, b) => {
      if (a.channel === "Website") return -1;
      if (b.channel === "Website") return 1;
      return b.revenue - a.revenue;
    });

    const websiteSales = channels.find((c) => c.channel === "Website")?.revenue || 0;
    const posSales = channels.filter((c) => c.channel !== "Website").reduce((acc, c) => acc + c.revenue, 0);

    const prevWebsiteSales = prevChannelRes
      .filter((c) => c.channel === "Website")
      .reduce((acc, c) => acc + Number(c.revenue || 0), 0);
    const prevPosSales = prevChannelRes
      .filter((c) => c.channel !== "Website")
      .reduce((acc, c) => acc + Number(c.revenue || 0), 0);

    const totalCancelledOrders = Number(currCancelled[0]?.count || 0);
    const cancelledAmount = Number(currCancelled[0]?.amount || 0);
    const totalReturnedOrders = Number(currReturned[0]?.count || 0);
    const returnedAmount = Number(currReturned[0]?.amount || 0);
    const grossSales = totalRevenue + cancelledAmount + returnedAmount;

    const prevRevenue = Number(prevRes[0]?.revenue || 0);
    const prevSubtotalRevenue = Number(prevRes[0]?.subtotalRevenue || 0);
    const prevShipping = Number(prevRes[0]?.shipping || 0);
    const prevOrders = Number(prevRes[0]?.orders || 0);
    const prevCancelledAmount = Number(prevCancelled[0]?.amount || 0);
    const prevReturnedAmount = Number(prevReturned[0]?.amount || 0);
    const prevGrossSales = prevRevenue + prevCancelledAmount + prevReturnedAmount;
    const prevNetProfit =
      prevRevenue - Number(prevCost[0]?.sum || 0) - prevShipping - Number(prevExpenses[0]?.sum || 0);
    const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0;

    const pctChange = (curr: number, prev: number) =>
      prev === 0 ? null : Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(1));

    // Populate all buckets in range (day vs month) — capped at "now" so a
    // period that extends into the future (e.g. "this month" viewed on the
    // 21st) doesn't pre-fill zero-value buckets for days that haven't
    // happened yet. Those trailing zeros would otherwise flatten the tail
    // of every trend line/sparkline into a dead-flat segment.
    const now = new Date();
    const bucketMap = new Map<string, number>();

    if (trendUnit === "month") {
      const curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const cappedEnd = endDate.getTime() > now.getTime() ? now : endDate;
      const end = new Date(cappedEnd.getFullYear(), cappedEnd.getMonth(), 1);
      while (curr <= end) {
        const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}-01`;
        bucketMap.set(key, 0);
        curr.setMonth(curr.getMonth() + 1);
      }

      salesTrend.forEach((item) => {
        if (item.bucket) {
          const d = new Date(item.bucket);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
          bucketMap.set(key, (bucketMap.get(key) || 0) + Number(item.amount || 0));
        }
      });
    } else {
      const currDate = new Date(startDate);
      const lastDate = endDate.getTime() > now.getTime() ? now : endDate;

      while (currDate <= lastDate) {
        const dateKey = currDate.toISOString().split("T")[0];
        bucketMap.set(dateKey, 0);
        currDate.setUTCDate(currDate.getUTCDate() + 1);
      }

      salesTrend.forEach((item) => {
        if (item.bucket) {
          const itemDateKey = new Date(item.bucket).toISOString().split("T")[0];
          if (bucketMap.has(itemDateKey)) {
            bucketMap.set(itemDateKey, (bucketMap.get(itemDateKey) || 0) + Number(item.amount || 0));
          } else {
            bucketMap.set(itemDateKey, Number(item.amount || 0));
          }
        }
      });
    }

    const trendData = Array.from(bucketMap.entries()).map(([dateStr, amount]) => ({
      date: new Date(dateStr).toISOString(),
      amount,
    }));

    return c.json({
      grossSales,
      totalRevenue,
      totalOrders,
      totalCost,
      totalShipping,
      totalExpenses,
      netProfit,
      aov,
      profitMargin: totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0,
      totalCancelledOrders,
      cancelledAmount,
      totalReturnedOrders,
      returnedAmount,
      websiteSales,
      posSales,
      channels,
      changes: {
        grossSales: pctChange(grossSales, prevGrossSales),
        revenue: pctChange(totalRevenue, prevRevenue),
        orders: pctChange(totalOrders, prevOrders),
        aov: pctChange(aov, prevAov),
        websiteSales: pctChange(websiteSales, prevWebsiteSales),
        posSales: pctChange(posSales, prevPosSales),
        cost: pctChange(totalCost, Number(prevCost[0]?.sum || 0)),
        shipping: pctChange(totalShipping, prevShipping),
        expenses: pctChange(totalExpenses, Number(prevExpenses[0]?.sum || 0)),
        netProfit: pctChange(netProfit, prevNetProfit),
        cancelledOrders: pctChange(totalCancelledOrders, Number(prevCancelled[0]?.count || 0)),
        returnedOrders: pctChange(totalReturnedOrders, Number(prevReturned[0]?.count || 0)),
      },
      trendData,
    });
  } catch (error) {
    console.error("Sales overview error:", error);
    return c.json({ error: "Failed to fetch sales data" }, 500);
  }
})

// Customer Lifetime Value (CLV)
.get('/clv',sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const result = await db.select({
      userId: orders.userId,
      totalAmount: sum(orders.totalAmount),
    })
    .from(orders)
    .where(and(isNotNull(orders.userId), ne(orders.status, "CANCELLED")))
    .groupBy(orders.userId);

    const validResults = result.filter(r => r.totalAmount !== null && r.userId);
    const averageCLV = validResults.length > 0 
      ? validResults.reduce((acc, curr) => acc + Number(curr.totalAmount || 0), 0) / validResults.length
      : 0;

    return c.json({ averageCLV });
  } catch (error) {
    console.error("CLV error:", error);
    return c.json({ error: "Failed to calculate CLV" }, 500);
  }
})

// Geographic Distribution
.get('/distribution',sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const data = await db.select({
      shippingState: orders.shippingState,
      totalAmount: sum(orders.totalAmount),
      count: count(orders.id),
    })
    .from(orders)
    .where(and(isNotNull(orders.shippingState), ne(orders.status, "CANCELLED")))
    .groupBy(orders.shippingState)
    .orderBy(desc(sum(orders.totalAmount)))
    .limit(10);

    return c.json(data.map(d => ({
      state: d.shippingState,
      revenue: Number(d.totalAmount || 0),
      orders: Number(d.count || 0)
    })));
  } catch (error) {
    console.error("Distribution error:", error);
    return c.json({ error: "Failed to fetch distribution data" }, 500);
  }
})

// Inventory Turnover
.get('/inventory-turnover',sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [salesRes, startingRes, endingRes] = await Promise.all([
      db.select({ sum: sum(orderItems.quantity) })
        .from(orderItems)
        .where(gte(orderItems.createdAt, startOfYear)),
      db.select({ sum: sum(products.stock) }).from(products),
      db.select({ sum: sum(products.stock) }).from(products)
    ]);

    const totalSales = Number(salesRes[0]?.sum || 0);
    const avgInventory = ((Number(startingRes[0]?.sum || 0)) + (Number(endingRes[0]?.sum || 0))) / 2 || 1;

    const turnover = totalSales / avgInventory;

    return c.json({ 
      turnoverRate: Number(turnover.toFixed(2)),
      totalSales,
      avgInventory
    });
  } catch (error) {
    console.error("Inventory turnover error:", error);
    return c.json({ error: "Failed to calculate inventory turnover" }, 500);
  }
})
  

// Cart Abandonment Rate
.get('/abandonment',sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const [totalCartsRes, convertedCartsRes] = await Promise.all([
      db.select({ count: count() }).from(carts),
      db.select({ count: count() })
        .from(carts)
        .where(sql`exists (
          select 1 from ${orders}
          where ${orders.userId} = ${carts.userId}
            and ${orders.createdAt} >= ${carts.createdAt}
        )`)
    ]);

    const total = Number(totalCartsRes[0]?.count || 0);
    const converted = Number(convertedCartsRes[0]?.count || 0);

    const abandonmentRate = total > 0 
      ? ((total - converted) / total) * 100 
      : 0;

    return c.json({ 
      abandonmentRate: Number(abandonmentRate.toFixed(2)),
      totalCarts: total,
      convertedCarts: converted
    });
  } catch (error) {
    console.error("Abandonment rate error:", error);
    return c.json({ error: "Failed to calculate abandonment rate" }, 500);
  }
})

// Cohort Retention
.get('/cohort',sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const cohortsRows = (await db.execute(sql`
      SELECT 
        DATE_TRUNC('month', u."createdAt") as cohort_month,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT o."userId") as retained_users
      FROM "User" u
      LEFT JOIN "orders" o 
        ON u.id = o."userId"
        AND o."createdAt" BETWEEN u."createdAt" AND u."createdAt" + INTERVAL '30 days'
      GROUP BY cohort_month
      ORDER BY cohort_month
    `)) as unknown as { rows: Array<{ cohort_month: string; total_users: string | number; retained_users: string | number }> };

    return c.json(cohortsRows.rows.map(c => {
      const totalUsers = Number(c.total_users);
      const retainedUsers = Number(c.retained_users);
      return {
        cohortMonth: new Date(c.cohort_month).toISOString(),
        totalUsers,
        retainedUsers,
        retentionRate: totalUsers > 0 
          ? (retainedUsers / totalUsers) * 100
          : 0
      };
    }));
  } catch (error) {
    console.error("Cohort error:", error);
    return c.json({ error: "Failed to fetch cohort data" }, 500);
  }
})

// Spending Clusters
.get('/spending-clusters',sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const segmentsRows = (await db.execute(sql`
      SELECT 
        CASE
          WHEN total_spent < 100 THEN 'Low'
          WHEN total_spent BETWEEN 100 AND 500 THEN 'Medium'
          ELSE 'High'
        END as segment,
        COUNT(*) as customers
      FROM (
        SELECT u.id, SUM(o."totalAmount") as total_spent
        FROM "User" u
        LEFT JOIN "orders" o ON u.id = o."userId"
        GROUP BY u.id
      ) as spending
      GROUP BY segment
    `)) as unknown as { rows: Array<{ segment: string; customers: string | number }> };

    return c.json(segmentsRows.rows.map(s => ({
      segment: s.segment,
      customers: Number(s.customers)
    })));
  } catch (error) {
    console.error("Spending clusters error:", error);
    return c.json({ error: "Failed to fetch customer segments" }, 500);
  }
})

// Customer Acquisition
.get('/acquisition', sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const { period = 'month', from, to } = c.req.query();
    const allowedPeriods = ['day', 'week', 'month', 'year'];
    const selectedPeriod = allowedPeriods.includes(period) ? period : 'month';
    const hasCustomRange = Boolean(from && to);
    const customRange = hasCustomRange ? resolveDateRange(selectedPeriod, from, to) : null;
    const startDate = customRange?.startDate ?? getStartDate(selectedPeriod);
    const endDate = customRange?.endDate ?? null;
    // Bucket finer than the window itself, otherwise a long range collapses to one bar
    const bucketUnit = endDate ? getTrendBucketUnit(startDate, endDate) : (selectedPeriod === 'year' ? 'month' : 'day');

    // bucketUnit/startDate/endDate passed as bound parameters (not sql.raw
    // string interpolation) — no user input ever gets spliced into the query
    // text itself.
    const usersRows = (await db.execute(sql`
      SELECT
        DATE_TRUNC(${bucketUnit}, "createdAt") as period,
        COUNT(*) as count
      FROM "User"
      WHERE "createdAt" >= ${startDate.toISOString()}
      ${endDate ? sql`AND "createdAt" <= ${endDate.toISOString()}` : sql``}
      GROUP BY period
      ORDER BY period ASC
    `)) as unknown as { rows: Array<{ period: string; count: string | number }> };

    return c.json(usersRows.rows.map(u => ({
      date: new Date(u.period).toISOString(),
      count: Number(u.count)
    })));
  } catch (error) {
    console.error("Acquisition error:", error);
    return c.json({ error: "Failed to fetch acquisition data" }, 500);
  }
})
.get('/most-purchased',sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const data = await db.select({
      productId: products.id,
      productName: products.name,
      productImages: products.images,
      totalSold: sum(orderItems.quantity),
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(ne(orders.status, "CANCELLED"))
    .groupBy(products.id, products.name, products.images)
    .orderBy(desc(sum(orderItems.quantity)))
    .limit(5);

    return c.json(data.map(item => ({
      productId: item.productId,
      productName: item.productName,
      productImages: item.productImages || [],
      totalSold: Number(item.totalSold || 0),
    })));
  } catch (error) {
    console.error("Most purchased error:", error);
    return c.json({ error: "Failed to fetch most purchased products" }, 500);
  }
})

.get('/most-wishlisted',sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }
  
  try {
    const data = await db.select({
      productId: products.id,
      productName: products.name,
      productImages: products.images,
      wishlistCount: count(wishlistItems.productId),
    })
    .from(wishlistItems)
    .innerJoin(products, eq(wishlistItems.productId, products.id))
    .groupBy(products.id, products.name, products.images)
    .orderBy(desc(count(wishlistItems.productId)))
    .limit(5);

    return c.json(data.map(item => ({
      productId: item.productId,
      productName: item.productName,
      productImages: item.productImages || [],
      wishlistCount: Number(item.wishlistCount || 0),
    })));
  } catch (error) {
    console.error("Most wishlisted error:", error);
    return c.json({ error: "Failed to fetch most wishlisted products" }, 500);
  }
})
.get('/recent-orders', sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const data = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      createdAt: orders.createdAt,
      status: orders.status,
      totalAmount: orders.totalAmount,
      guestName: orders.guestName,
      userName: users.name,
      saleType: orders.saleType,
      reference: orders.reference,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.createdAt))
    .limit(5);

    return c.json(data.map(item => ({
      ...item,
      customerName: item.userName || item.guestName || "Guest",
      saleType: item.saleType,
      reference: item.reference,
    })));
  } catch (error) {
    console.error("Recent orders error:", error);
    return c.json({ error: "Failed to fetch recent orders" }, 500);
  }
})
.get('/low-stock', sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const threshold = 10;
    const data = await db.select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      images: products.images,
    })
    .from(products)
    .where(lte(products.stock, threshold))
    .orderBy(asc(products.stock))
    .limit(10);

    return c.json(data);
  } catch (error) {
    console.error("Low stock error:", error);
    return c.json({ error: "Failed to fetch low stock" }, 500);
  }
})

// The dashboard overview page asked for these nine datasets as nine separate
// HTTP requests. Each one re-ran sessionMiddleware and opened its own
// database round trip, so a single page load cost thirteen requests (three of
// them are the parameterised sales-overview) and, underneath, twelve queries
// — each one waking the Neon compute in turn.
//
// db.batch sends every statement in one HTTP round trip and runs them as a
// single transaction, so the whole set now costs one request and one wake.
// The individual endpoints above are kept: they are the RPC surface the types
// are generated from, and nothing forces a caller to use this one.
.get('/overview', sessionMiddleware, async (c) => {
  const user = c.get("user");
  if (!canViewAnalytics(user)) {
    return c.json({ success: false, error: 'Unauthorized' }, 403);
  }

  try {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const LOW_STOCK_THRESHOLD = 10;

    const [
      clvRows,
      turnoverSoldRows,
      turnoverStockRows,
      totalCartsRows,
      convertedCartsRows,
      cohortRows,
      clusterRows,
      mostPurchasedRows,
      mostWishlistedRows,
      recentOrderRows,
      lowStockRows,
    ] = await db.batch([
      db.select({ userId: orders.userId, totalAmount: sum(orders.totalAmount) })
        .from(orders)
        .where(and(isNotNull(orders.userId), ne(orders.status, "CANCELLED")))
        .groupBy(orders.userId),

      db.select({ sum: sum(orderItems.quantity) })
        .from(orderItems)
        .where(gte(orderItems.createdAt, startOfYear)),

      // The standalone endpoint queried total stock twice and averaged it
      // with itself; one read is the same number without the second query.
      db.select({ sum: sum(products.stock) }).from(products),

      db.select({ count: count() }).from(carts),

      db.select({ count: count() })
        .from(carts)
        .where(sql`exists (
          select 1 from ${orders}
          where ${orders.userId} = ${carts.userId}
            and ${orders.createdAt} >= ${carts.createdAt}
        )`),

      db.execute(sql`
        SELECT
          DATE_TRUNC('month', u."createdAt") as cohort_month,
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT o."userId") as retained_users
        FROM "User" u
        LEFT JOIN "orders" o
          ON u.id = o."userId"
          AND o."createdAt" BETWEEN u."createdAt" AND u."createdAt" + INTERVAL '30 days'
        GROUP BY cohort_month
        ORDER BY cohort_month
      `),

      db.execute(sql`
        SELECT
          CASE
            WHEN total_spent < 100 THEN 'Low'
            WHEN total_spent BETWEEN 100 AND 500 THEN 'Medium'
            ELSE 'High'
          END as segment,
          COUNT(*) as customers
        FROM (
          SELECT u.id, SUM(o."totalAmount") as total_spent
          FROM "User" u
          LEFT JOIN "orders" o ON u.id = o."userId"
          GROUP BY u.id
        ) as spending
        GROUP BY segment
      `),

      db.select({
        productId: products.id,
        productName: products.name,
        productImages: products.images,
        totalSold: sum(orderItems.quantity),
      })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(ne(orders.status, "CANCELLED"))
        .groupBy(products.id, products.name, products.images)
        .orderBy(desc(sum(orderItems.quantity)))
        .limit(5),

      db.select({
        productId: products.id,
        productName: products.name,
        productImages: products.images,
        wishlistCount: count(wishlistItems.productId),
      })
        .from(wishlistItems)
        .innerJoin(products, eq(wishlistItems.productId, products.id))
        .groupBy(products.id, products.name, products.images)
        .orderBy(desc(count(wishlistItems.productId)))
        .limit(5),

      db.select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        createdAt: orders.createdAt,
        status: orders.status,
        totalAmount: orders.totalAmount,
        guestName: orders.guestName,
        userName: users.name,
        saleType: orders.saleType,
        reference: orders.reference,
      })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .orderBy(desc(orders.createdAt))
        .limit(5),

      db.select({
        id: products.id,
        name: products.name,
        stock: products.stock,
        images: products.images,
      })
        .from(products)
        .where(lte(products.stock, LOW_STOCK_THRESHOLD))
        .orderBy(asc(products.stock))
        .limit(10),
    ]);

    const payingCustomers = clvRows.filter((r) => r.totalAmount !== null && r.userId);
    const averageCLV = payingCustomers.length > 0
      ? payingCustomers.reduce((acc, r) => acc + Number(r.totalAmount || 0), 0) / payingCustomers.length
      : 0;

    const totalSold = Number(turnoverSoldRows[0]?.sum || 0);
    const avgInventory = Number(turnoverStockRows[0]?.sum || 0) || 1;

    const totalCarts = Number(totalCartsRows[0]?.count || 0);
    const convertedCarts = Number(convertedCartsRows[0]?.count || 0);
    const abandonmentRate = totalCarts > 0
      ? ((totalCarts - convertedCarts) / totalCarts) * 100
      : 0;

    const cohorts = (cohortRows as unknown as {
      rows: Array<{ cohort_month: string; total_users: string | number; retained_users: string | number }>;
    }).rows;

    const clusters = (clusterRows as unknown as {
      rows: Array<{ segment: string; customers: string | number }>;
    }).rows;

    return c.json({
      clv: { averageCLV },
      inventoryTurnover: {
        turnoverRate: Number((totalSold / avgInventory).toFixed(2)),
        totalSales: totalSold,
        avgInventory,
      },
      abandonment: {
        abandonmentRate: Number(abandonmentRate.toFixed(2)),
        totalCarts,
        convertedCarts,
      },
      cohort: cohorts.map((row) => {
        const totalUsers = Number(row.total_users);
        const retainedUsers = Number(row.retained_users);
        return {
          cohortMonth: new Date(row.cohort_month).toISOString(),
          totalUsers,
          retainedUsers,
          retentionRate: totalUsers > 0 ? (retainedUsers / totalUsers) * 100 : 0,
        };
      }),
      spendingClusters: clusters.map((row) => ({
        segment: row.segment,
        customers: Number(row.customers),
      })),
      mostPurchased: mostPurchasedRows.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productImages: item.productImages || [],
        totalSold: Number(item.totalSold || 0),
      })),
      mostWishlisted: mostWishlistedRows.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productImages: item.productImages || [],
        wishlistCount: Number(item.wishlistCount || 0),
      })),
      recentOrders: recentOrderRows.map((item) => ({
        ...item,
        customerName: item.userName || item.guestName || "Guest",
        saleType: item.saleType,
        reference: item.reference,
      })),
      lowStock: lowStockRows,
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    return c.json({ error: "Failed to fetch dashboard overview" }, 500);
  }
});

export default app;