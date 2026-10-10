import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@/db";
import { sessionMiddleware } from "@/lib/session-middleware";
import { canViewAnalytics } from "@/lib/analytics-access";
import { getPreviousRange } from "@/lib/date-utils";
import { bucketUnit } from "../lib/buckets";
import { getBreakdown, getFunnel, getKpis, getLive, getProducts, getSeries } from "./queries";
import { breakdownQuerySchema, productsQuerySchema, rangeQuerySchema, toRangeAndFilters } from "./query-params";

const unauthorized = { error: "Unauthorized" } as const;
const invalidRange = { error: "Invalid date range" } as const;
const failed = { error: "Failed to load analytics" } as const;

const app = new Hono()
  .get("/overview", sessionMiddleware, zValidator("query", rangeQuerySchema), async (c) => {
    if (!canViewAnalytics(c.get("user"))) return c.json(unauthorized, 403);
    const parsed = toRangeAndFilters(c.req.valid("query"));
    if (!parsed) return c.json(invalidRange, 400);
    const { range, filters } = parsed;
    const prev = getPreviousRange(range.start, range.end);
    const unit = bucketUnit(range.start, range.end);
    try {
      const [kpis, previous, series] = await Promise.all([
        getKpis(db, range, filters),
        getKpis(db, { start: prev.startDate, end: prev.endDate }, filters),
        getSeries(db, range, filters, unit),
      ]);
      return c.json({ kpis, previous, series, unit });
    } catch (err) {
      console.error("Web analytics overview failed:", err);
      return c.json(failed, 500);
    }
  })
  .get("/breakdown", sessionMiddleware, zValidator("query", breakdownQuerySchema), async (c) => {
    if (!canViewAnalytics(c.get("user"))) return c.json(unauthorized, 403);
    const query = c.req.valid("query");
    const parsed = toRangeAndFilters(query);
    if (!parsed) return c.json(invalidRange, 400);
    try {
      const rows = await getBreakdown(db, parsed.range, parsed.filters, query.dim, query.limit);
      return c.json({ rows });
    } catch (err) {
      console.error("Web analytics breakdown failed:", err);
      return c.json(failed, 500);
    }
  })
  .get("/funnel", sessionMiddleware, zValidator("query", rangeQuerySchema), async (c) => {
    if (!canViewAnalytics(c.get("user"))) return c.json(unauthorized, 403);
    const parsed = toRangeAndFilters(c.req.valid("query"));
    if (!parsed) return c.json(invalidRange, 400);
    try {
      return c.json(await getFunnel(db, parsed.range, parsed.filters));
    } catch (err) {
      console.error("Web analytics funnel failed:", err);
      return c.json(failed, 500);
    }
  })
  .get("/products", sessionMiddleware, zValidator("query", productsQuerySchema), async (c) => {
    if (!canViewAnalytics(c.get("user"))) return c.json(unauthorized, 403);
    const query = c.req.valid("query");
    const parsed = toRangeAndFilters(query);
    if (!parsed) return c.json(invalidRange, 400);
    try {
      const rows = await getProducts(db, parsed.range, parsed.filters, query.limit);
      return c.json({ rows });
    } catch (err) {
      console.error("Web analytics products failed:", err);
      return c.json(failed, 500);
    }
  })
  .get("/live", sessionMiddleware, async (c) => {
    if (!canViewAnalytics(c.get("user"))) return c.json(unauthorized, 403);
    try {
      return c.json(await getLive(db));
    } catch (err) {
      console.error("Web analytics live failed:", err);
      return c.json(failed, 500);
    }
  });

export default app;
