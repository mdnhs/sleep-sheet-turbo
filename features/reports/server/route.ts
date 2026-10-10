import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { db } from "@/db";
import { orders, orderItems, products, expenses, expenseCategories, users } from "@/db/schema";
import { eq, ne, and, gte, lte, desc, sum, count, isNotNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { isAllowed } from "@/lib/permissions";

const BREAKDOWN_LIMIT = 200;

const app = new Hono()
  .get(
    "/monthly",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!isAllowed(user, "reports", "read", ["MODERATOR"])) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { from, to } = c.req.valid("query");

      let fromDate: Date | undefined;
      if (from) {
        const d = new Date(from);
        if (!isNaN(d.getTime())) {
          if (!from.includes("T")) {
            d.setHours(0, 0, 0, 0);
          }
          fromDate = d;
        }
      }
      let toDate: Date | undefined;
      if (to) {
        const d = new Date(to);
        if (!isNaN(d.getTime())) {
          if (!to.includes("T") || d.getHours() === 0) {
            d.setHours(23, 59, 59, 999);
          }
          toDate = d;
        }
      }

      const orderConditions: SQL[] = [
        ne(orders.status, "CANCELLED"),
        ne(orders.status, "REFUNDED"),
      ];
      if (fromDate) orderConditions.push(gte(orders.createdAt, fromDate));
      if (toDate) orderConditions.push(lte(orders.createdAt, toDate));
      const orderWhere = and(...orderConditions);

      const expenseConditions: SQL[] = [];
      if (fromDate) expenseConditions.push(gte(expenses.date, fromDate));
      if (toDate) expenseConditions.push(lte(expenses.date, toDate));
      const expenseWhere = expenseConditions.length ? and(...expenseConditions) : undefined;

      const monthOf = (column: AnyPgColumn) =>
        sql<string>`TO_CHAR(DATE_TRUNC('month', ${column}), 'YYYY-MM')`;

      const itemCost = sql<number>`SUM(${orderItems.quantity} * COALESCE(${orderItems.costPrice}, 0))`;

      // One batched round trip for the three aggregates instead of three
      // separate requests to the database.
      const [monthlyOrders, monthlyCosts, monthlyExpenses] = await db.batch([
        db.select({
            month: monthOf(orders.createdAt),
            revenue: sum(sql<number>`${orders.totalAmount} - COALESCE(${orders.refundedAmount}, 0)`),
            shippingCost: sum(orders.shippingCost),
          })
          .from(orders)
          .where(orderWhere)
          .groupBy(monthOf(orders.createdAt)),
        db.select({
            month: monthOf(orders.createdAt),
            cost: itemCost,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(orderWhere)
          .groupBy(monthOf(orders.createdAt)),
        db.select({
            month: monthOf(expenses.date),
            expense: sum(expenses.amount),
          })
          .from(expenses)
          .where(expenseWhere)
          .groupBy(monthOf(expenses.date)),
      ]);

      const monthlyMap: Record<string, { month: string; revenue: number; cost: number; shippingCost: number; expense: number; profit: number }> = {};
      const initMonth = (month: string) => {
        if (!monthlyMap[month]) {
          monthlyMap[month] = { month, revenue: 0, cost: 0, shippingCost: 0, expense: 0, profit: 0 };
        }
        return monthlyMap[month];
      };

      for (const row of monthlyOrders) {
        if (!row.month) continue;
        const m = initMonth(row.month);
        m.revenue = Number(row.revenue || 0);
        m.shippingCost = Number(row.shippingCost || 0);
      }
      for (const row of monthlyCosts) {
        if (!row.month) continue;
        initMonth(row.month).cost = Number(row.cost || 0);
      }
      for (const row of monthlyExpenses) {
        if (!row.month) continue;
        initMonth(row.month).expense = Number(row.expense || 0);
      }

      const monthlyData = Object.values(monthlyMap)
        .map((m) => ({ ...m, profit: m.revenue - (m.cost + m.shippingCost + m.expense) }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return c.json({ monthlyData });
    }
  )
  .get(
    "/",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!isAllowed(user, "reports", "read", ["MODERATOR"])) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { from, to } = c.req.valid("query");

      // Normalize to full-day boundaries so "Today" covers the whole day
      let fromDate: Date | undefined;
      if (from) {
        const d = new Date(from);
        if (!isNaN(d.getTime())) {
          if (!from.includes("T")) {
            d.setHours(0, 0, 0, 0);
          }
          fromDate = d;
        }
      }
      let toDate: Date | undefined;
      if (to) {
        const d = new Date(to);
        if (!isNaN(d.getTime())) {
          if (!to.includes("T") || d.getHours() === 0) {
            d.setHours(23, 59, 59, 999);
          }
          toDate = d;
        }
      }

      const orderConditions: SQL[] = [
        ne(orders.status, "CANCELLED"),
        ne(orders.status, "REFUNDED"),
      ];
      if (fromDate) orderConditions.push(gte(orders.createdAt, fromDate));
      if (toDate) orderConditions.push(lte(orders.createdAt, toDate));
      const orderWhere = and(...orderConditions);

      const cancelledConditions: SQL[] = [eq(orders.status, "CANCELLED")];
      if (fromDate) cancelledConditions.push(gte(orders.createdAt, fromDate));
      if (toDate) cancelledConditions.push(lte(orders.createdAt, toDate));
      const cancelledWhere = and(...cancelledConditions);

      const returnedConditions: SQL[] = [
        sql`(${orders.status} = 'REFUNDED' OR (${orders.refundedAmount} IS NOT NULL AND ${orders.refundedAmount} > 0))`,
      ];
      if (fromDate) returnedConditions.push(gte(orders.createdAt, fromDate));
      if (toDate) returnedConditions.push(lte(orders.createdAt, toDate));
      const returnedWhere = and(...returnedConditions);

      const expenseConditions: SQL[] = [];
      if (fromDate) expenseConditions.push(gte(expenses.date, fromDate));
      if (toDate) expenseConditions.push(lte(expenses.date, toDate));
      const expenseWhere = expenseConditions.length ? and(...expenseConditions) : undefined;

      const itemCost = sql<number>`SUM(${orderItems.quantity} * COALESCE(${orderItems.costPrice}, 0))`;
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

      const [
        orderTotals,
        costTotals,
        expenseTotals,
        cancelledTotals,
        returnedTotals,
        allOrdersTotals,
        allCostsTotals,
        itemTotals,
        productCostBreakdown,
        revenueBreakdown,
        shippingBreakdown,
        expenseBreakdown,
        cancelledBreakdown,
        returnedBreakdown,
        pageOrders,
        pageCosts,
        pageCancelled,
      ] =
        // Batched: aggregates and breakdowns, one round trip.
        await db.batch([
          db.select({
              revenue: sum(sql<number>`${orders.totalAmount} - COALESCE(${orders.refundedAmount}, 0)`),
              // subtotal, not totalAmount — totalAmount already has
              // shippingCost folded in, which would cancel out the
              // shippingCost subtraction in the profit calc below. Kept as a
              // separate field so `revenue` (Total Net Sale) still reflects
              // the full amount actually charged.
              subtotalRevenue: sum(sql<number>`${orders.subtotal} - COALESCE(${orders.refundedAmount}, 0)`),
              shipping: sum(orders.shippingCost),
              orders: count(),
            })
            .from(orders)
            .where(orderWhere),
          db.select({ cost: itemCost })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .where(orderWhere),
          db.select({ sum: sum(expenses.amount) })
            .from(expenses)
            .where(expenseWhere),
          db.select({
              count: count(),
              amount: sum(orders.totalAmount),
            })
            .from(orders)
            .where(cancelledWhere),
          db.select({
              count: count(),
              amount: sum(sql<number>`COALESCE(${orders.refundedAmount}, ${orders.totalAmount})`),
            })
            .from(orders)
            .where(returnedWhere),
          db.select({
              amount: sum(orders.totalAmount),
            })
            .from(orders),
          db.select({ cost: itemCost })
            .from(orderItems),
          db.select({ items: sum(orderItems.quantity) })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .where(orderWhere),
          db.select({
              orderId: orders.id,
              orderNumber: orders.orderNumber,
              customerName: sql<string>`COALESCE(${users.name}, ${orders.guestName}, 'Guest')`,
              productName: sql<string>`COALESCE(STRING_AGG(DISTINCT ${products.name}, ', '), 'Unknown Product')`,
              quantity: sum(orderItems.quantity),
              costPrice: sql<number>`SUM(${orderItems.quantity} * COALESCE(${orderItems.costPrice}, 0)) / NULLIF(SUM(${orderItems.quantity}), 0)`,
              totalItemCost: sum(sql<number>`${orderItems.quantity} * COALESCE(${orderItems.costPrice}, 0)`),
              date: orders.createdAt,
            })
            .from(orders)
            .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
            .leftJoin(products, eq(orderItems.productId, products.id))
            .leftJoin(users, eq(orders.userId, users.id))
            .where(orderWhere)
            .groupBy(orders.id, orders.orderNumber, orders.createdAt, users.name, orders.guestName)
            .orderBy(desc(orders.createdAt))
            .limit(BREAKDOWN_LIMIT),
          db.select({
              orderId: orders.id,
              orderNumber: orders.orderNumber,
              customerName: sql<string>`COALESCE(${users.name}, ${orders.guestName}, 'Guest')`,
              date: orders.createdAt,
              totalAmount: sql<number>`${orders.totalAmount} - COALESCE(${orders.refundedAmount}, 0)`,
            })
            .from(orders)
            .leftJoin(users, eq(orders.userId, users.id))
            .where(orderWhere)
            .orderBy(desc(orders.createdAt))
            .limit(BREAKDOWN_LIMIT),
          db.select({
              orderId: orders.id,
              orderNumber: orders.orderNumber,
              customerName: sql<string>`COALESCE(${users.name}, ${orders.guestName}, 'Guest')`,
              quantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
              date: orders.createdAt,
              shippingCost: orders.shippingCost,
            })
            .from(orders)
            .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
            .leftJoin(users, eq(orders.userId, users.id))
            .where(and(orderWhere, sql`${orders.shippingCost} > 0`))
            .groupBy(orders.id, orders.orderNumber, orders.createdAt, orders.shippingCost, users.name, orders.guestName)
            .orderBy(desc(orders.createdAt))
            .limit(BREAKDOWN_LIMIT),
          db.select({
              id: expenses.id,
              date: expenses.date,
              amount: expenses.amount,
              category: expenseCategories.name,
              description: expenses.note,
            })
            .from(expenses)
            .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
            .where(expenseWhere)
            .orderBy(desc(expenses.date))
            .limit(BREAKDOWN_LIMIT),
          db.select({
              orderId: orders.id,
              orderNumber: orders.orderNumber,
              date: orders.createdAt,
              totalAmount: orders.totalAmount,
              reason: orders.cancellationReason,
            })
            .from(orders)
            .where(cancelledWhere)
            .orderBy(desc(orders.createdAt))
            .limit(BREAKDOWN_LIMIT),
          db.select({
              orderId: orders.id,
              orderNumber: orders.orderNumber,
              date: orders.createdAt,
              refundedAmount: sql<number>`COALESCE(${orders.refundedAmount}, ${orders.totalAmount})`,
              reason: orders.refundReason,
            })
            .from(orders)
            .where(returnedWhere)
            .orderBy(desc(orders.createdAt))
            .limit(BREAKDOWN_LIMIT),
          db.select({
              page: pageRef,
              orderCount: count(orders.id),
              revenue: sum(sql<number>`${orders.totalAmount} - COALESCE(${orders.refundedAmount}, 0)`),
              shippingCost: sum(orders.shippingCost),
            })
            .from(orders)
            .where(orderWhere)
            .groupBy(pageRef),
          db.select({
              page: pageRef,
              cost: itemCost,
              itemsSold: sum(orderItems.quantity),
            })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .where(orderWhere)
            .groupBy(pageRef),
          db.select({
              page: pageRef,
              count: count(orders.id),
              amount: sum(orders.totalAmount),
            })
            .from(orders)
            .where(cancelledWhere)
            .groupBy(pageRef),
        ]);

      const totalRevenue = Number(orderTotals[0]?.revenue || 0);
      const subtotalRevenue = Number(orderTotals[0]?.subtotalRevenue || 0);
      const totalShippingCost = Number(orderTotals[0]?.shipping || 0);
      const orderCount = Number(orderTotals[0]?.orders || 0);
      const totalCost = Number(costTotals[0]?.cost || 0);
      const totalExpenseAmount = Number(expenseTotals[0]?.sum || 0);
      const cancelledCount = Number(cancelledTotals[0]?.count || 0);
      const cancelledAmount = Number(cancelledTotals[0]?.amount || 0);
      const returnedCount = Number(returnedTotals[0]?.count || 0);
      const returnedAmount = Number(returnedTotals[0]?.amount || 0);
      const grossSales = Number(allOrdersTotals[0]?.amount || 0);
      const grossCost = Number(allCostsTotals[0]?.cost || 0);
      const cancelledCost = grossCost - totalCost;
      const totalItemsSold = Number(itemTotals[0]?.items || 0);

      const grossProfit = totalRevenue - (totalCost + totalShippingCost);
      const netProfit = grossProfit - totalExpenseAmount;

      const pageMap: Record<
        string,
        {
          page: string;
          orderCount: number;
          itemsSold: number;
          revenue: number;
          cost: number;
          shippingCost: number;
          profit: number;
          margin: number;
          cancelledCount: number;
          cancelledAmount: number;
        }
      > = {};

      const initPage = (page: string) => {
        if (!pageMap[page]) {
          pageMap[page] = {
            page,
            orderCount: 0,
            itemsSold: 0,
            revenue: 0,
            cost: 0,
            shippingCost: 0,
            profit: 0,
            margin: 0,
            cancelledCount: 0,
            cancelledAmount: 0,
          };
        }
        return pageMap[page];
      };

      for (const row of pageOrders) {
        if (!row.page) continue;
        const p = initPage(row.page);
        p.orderCount = Number(row.orderCount || 0);
        p.revenue = Number(row.revenue || 0);
        p.shippingCost = Number(row.shippingCost || 0);
      }

      for (const row of pageCosts) {
        if (!row.page) continue;
        const p = initPage(row.page);
        p.cost = Number(row.cost || 0);
        p.itemsSold = Number(row.itemsSold || 0);
      }

      for (const row of pageCancelled) {
        if (!row.page) continue;
        const p = initPage(row.page);
        p.cancelledCount = Number(row.count || 0);
        p.cancelledAmount = Number(row.amount || 0);
      }

      const pageWiseBreakdown = Object.values(pageMap)
        .filter((p) => p.orderCount > 0 || p.revenue > 0 || p.cancelledCount > 0)
        .map((p) => {
          const profit = p.revenue - (p.cost + p.shippingCost);
          const margin = p.revenue > 0 ? Math.round((profit / p.revenue) * 100) : 0;
          return {
            ...p,
            profit,
            margin,
          };
        })
        .sort((a, b) => {
          if (a.page === "Website") return -1;
          if (b.page === "Website") return 1;
          return b.revenue - a.revenue;
        });

      return c.json({
        totalRevenue,
        grossSales,
        totalCost,
        grossCost,
        cancelledCost,
        totalShippingCost,
        grossProfit,
        totalExpense: totalExpenseAmount,
        netProfit,
        orderCount,
        totalItemsSold,
        cancelledCount,
        cancelledAmount,
        returnedCount,
        returnedAmount,
        pageWiseBreakdown,
        productCostBreakdown: productCostBreakdown.map((item) => ({
          ...item,
          productName: item.productName || "Unknown Product",
          costPrice: Number(item.costPrice || 0),
          totalItemCost: Number(item.totalItemCost || 0),
        })),
        revenueBreakdown: revenueBreakdown.map(item => ({ ...item, totalAmount: Number(item.totalAmount || 0) })),
        shippingBreakdown: shippingBreakdown.map(item => ({ ...item, quantity: Number(item.quantity || 0), shippingCost: Number(item.shippingCost || 0) })),
        expenseBreakdown: expenseBreakdown.map(item => ({ ...item, amount: Number(item.amount || 0) })),
        cancelledBreakdown: cancelledBreakdown.map(item => ({ ...item, totalAmount: Number(item.totalAmount || 0) })),
        returnedBreakdown: returnedBreakdown.map(item => ({ ...item, refundedAmount: Number(item.refundedAmount || 0) })),
        breakdownTruncated: productCostBreakdown.length === BREAKDOWN_LIMIT || revenueBreakdown.length === BREAKDOWN_LIMIT || shippingBreakdown.length === BREAKDOWN_LIMIT || expenseBreakdown.length === BREAKDOWN_LIMIT,
      });
    }
  );

export default app;
