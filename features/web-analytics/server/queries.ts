import { sql } from "drizzle-orm";
import type { db, Transaction } from "@/db";
import { ANALYTICS_TZ, type BucketUnit } from "../lib/buckets";
import { DIMENSIONS, type Dimension, type Filters } from "../lib/dimensions";
import type { BreakdownRow, Funnel, Kpis, LiveSnapshot, ProductRow, SeriesPoint } from "../lib/types";
import { filterSql, inRange, ORDER_AMOUNT, qualifyingCte, sessionFilter, VALID_ORDER, type Range } from "./filters";

/** The app's db, or a transaction (the DB tests run every query inside one and roll it back). */
export type Db = typeof db | Transaction;

const num = (value: unknown): number => Number(value ?? 0) || 0;

export async function getKpis(ex: Db, r: Range, f: Filters): Promise<Kpis> {
  const { rows } = await ex.execute<{
    visitors: string;
    page_views: string;
    sessions: string;
    bounced: string;
    orders: string;
    revenue: string | null;
  }>(sql`
    WITH ${qualifyingCte(r, f)}
    pv AS (
      SELECT visitor_id, session_id FROM analytics_events
      WHERE type = 'page_view' AND ${inRange(r)} ${filterSql(f)}
    ),
    s AS (
      SELECT e.session_id, count(*) AS page_count FROM analytics_events e
      WHERE e.type = 'page_view' AND ${inRange(r, sql`e.ts`)}
        AND e.session_id IN (SELECT session_id FROM pv)
      GROUP BY e.session_id
    ),
    o AS (
      SELECT DISTINCT ord.id, ${ORDER_AMOUNT} AS amount
      FROM analytics_events e JOIN orders ord ON ord.id = e.order_id
      WHERE e.type = 'order_complete' AND ${inRange(r, sql`e.ts`)}
        ${sessionFilter(sql`e.session_id`, f)} AND ${VALID_ORDER}
    )
    SELECT
      (SELECT count(DISTINCT visitor_id) FROM pv) AS visitors,
      (SELECT count(*) FROM pv) AS page_views,
      (SELECT count(*) FROM s) AS sessions,
      (SELECT count(*) FROM s WHERE page_count = 1) AS bounced,
      (SELECT count(*) FROM o) AS orders,
      (SELECT sum(amount) FROM o) AS revenue
  `);

  const row = rows[0];
  const visitors = num(row?.visitors);
  const sessions = num(row?.sessions);
  const bounced = num(row?.bounced);
  const ordersCount = num(row?.orders);
  return {
    visitors,
    pageViews: num(row?.page_views),
    sessions,
    bounced,
    bounceRate: sessions ? bounced / sessions : 0,
    orders: ordersCount,
    revenue: num(row?.revenue),
    conversionRate: visitors ? ordersCount / visitors : 0,
  };
}

export async function getSeries(ex: Db, r: Range, f: Filters, unit: BucketUnit): Promise<SeriesPoint[]> {
  const step = `1 ${unit}`;
  // Buckets are generated in Dhaka wall-clock time and converted back, so a
  // month step lands on the 1st (stepping in UTC would drift after 31-day months).
  const { rows } = await ex.execute<{
    bucket: string;
    visitors: string;
    page_views: string;
    sessions: string;
    bounced: string;
    orders: string;
    revenue: string | null;
  }>(sql`
    WITH ${qualifyingCte(r, f)}
    buckets AS (
      SELECT g AT TIME ZONE ${ANALYTICS_TZ} AS bucket
      FROM generate_series(
        date_trunc(${unit}, ${r.start}::timestamptz, ${ANALYTICS_TZ}) AT TIME ZONE ${ANALYTICS_TZ},
        date_trunc(${unit}, ${r.end}::timestamptz, ${ANALYTICS_TZ}) AT TIME ZONE ${ANALYTICS_TZ},
        CAST(${step} AS interval)
      ) AS g
    ),
    pv AS (
      SELECT date_trunc(${unit}, ts, ${ANALYTICS_TZ}) AS bucket,
        count(DISTINCT visitor_id) AS visitors, count(*) AS page_views
      FROM analytics_events
      WHERE type = 'page_view' AND ${inRange(r)} ${filterSql(f)}
      GROUP BY 1
    ),
    s AS (
      SELECT date_trunc(${unit}, first_ts, ${ANALYTICS_TZ}) AS bucket,
        count(*) AS sessions, count(*) FILTER (WHERE page_count = 1) AS bounced
      FROM (
        SELECT e.session_id, min(e.ts) AS first_ts, count(*) AS page_count
        FROM analytics_events e
        WHERE e.type = 'page_view' AND ${inRange(r, sql`e.ts`)}
          AND e.session_id IN (
            SELECT session_id FROM analytics_events
            WHERE type = 'page_view' AND ${inRange(r)} ${filterSql(f)}
          )
        GROUP BY e.session_id
      ) per_session
      GROUP BY 1
    ),
    o AS (
      SELECT date_trunc(${unit}, first_ts, ${ANALYTICS_TZ}) AS bucket,
        count(*) AS orders, sum(amount) AS revenue
      FROM (
        SELECT ord.id, min(e.ts) AS first_ts, min(${ORDER_AMOUNT}) AS amount
        FROM analytics_events e JOIN orders ord ON ord.id = e.order_id
        WHERE e.type = 'order_complete' AND ${inRange(r, sql`e.ts`)}
          ${sessionFilter(sql`e.session_id`, f)} AND ${VALID_ORDER}
        GROUP BY ord.id
      ) per_order
      GROUP BY 1
    )
    SELECT
      to_char(b.bucket AT TIME ZONE ${ANALYTICS_TZ}, 'YYYY-MM-DD"T"HH24:MI:SS') AS bucket,
      COALESCE(pv.visitors, 0) AS visitors,
      COALESCE(pv.page_views, 0) AS page_views,
      COALESCE(s.sessions, 0) AS sessions,
      COALESCE(s.bounced, 0) AS bounced,
      COALESCE(o.orders, 0) AS orders,
      COALESCE(o.revenue, 0) AS revenue
    FROM buckets b
    LEFT JOIN pv ON pv.bucket = b.bucket
    LEFT JOIN s ON s.bucket = b.bucket
    LEFT JOIN o ON o.bucket = b.bucket
    ORDER BY b.bucket
  `);

  return rows.map((row) => ({
    bucket: row.bucket,
    visitors: num(row.visitors),
    pageViews: num(row.page_views),
    sessions: num(row.sessions),
    bounced: num(row.bounced),
    orders: num(row.orders),
    revenue: num(row.revenue),
  }));
}

export async function getBreakdown(
  ex: Db,
  r: Range,
  f: Filters,
  dim: Dimension,
  limit: number,
): Promise<BreakdownRow[]> {
  const column = sql.identifier(DIMENSIONS[dim]);
  // Order events carry the session's landing attributes, so grouping them by
  // the same column attributes each order to its referrer / campaign.
  const { rows } = await ex.execute<{ key: string | null; visitors: string; orders: string; revenue: string | null }>(sql`
    WITH ${qualifyingCte(r, f)}
    v AS (
      SELECT ${column} AS key, count(DISTINCT visitor_id) AS visitors
      FROM analytics_events
      WHERE type = 'page_view' AND ${inRange(r)} ${filterSql(f)}
      GROUP BY 1
    ),
    o AS (
      SELECT key, count(*) AS orders, sum(amount) AS revenue
      FROM (
        SELECT DISTINCT ON (ord.id) e.${column} AS key, ${ORDER_AMOUNT} AS amount
        FROM analytics_events e JOIN orders ord ON ord.id = e.order_id
        WHERE e.type = 'order_complete' AND ${inRange(r, sql`e.ts`)}
          ${sessionFilter(sql`e.session_id`, f)} AND ${VALID_ORDER}
        ORDER BY ord.id, e.ts
      ) per_order
      GROUP BY 1
    )
    SELECT v.key, v.visitors, COALESCE(o.orders, 0) AS orders, COALESCE(o.revenue, 0) AS revenue
    FROM v LEFT JOIN o ON o.key IS NOT DISTINCT FROM v.key
    ORDER BY v.visitors DESC, v.key ASC NULLS LAST
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    key: row.key,
    visitors: num(row.visitors),
    orders: num(row.orders),
    revenue: num(row.revenue),
  }));
}

export async function getFunnel(ex: Db, r: Range, f: Filters): Promise<Funnel> {
  const { rows } = await ex.execute<{
    visited: string;
    viewed_product: string;
    added_to_cart: string;
    started_checkout: string;
    ordered: string;
  }>(sql`
    WITH ${qualifyingCte(r, f)}
    ev AS (
      SELECT e.session_id, e.type, e.order_id FROM analytics_events e
      WHERE ${inRange(r, sql`e.ts`)} ${sessionFilter(sql`e.session_id`, f)}
    )
    SELECT
      count(DISTINCT session_id) FILTER (WHERE type = 'page_view') AS visited,
      count(DISTINCT session_id) FILTER (WHERE type = 'product_view') AS viewed_product,
      count(DISTINCT session_id) FILTER (WHERE type IN ('add_to_cart', 'buy_now')) AS added_to_cart,
      count(DISTINCT session_id) FILTER (WHERE type = 'checkout_start') AS started_checkout,
      (
        SELECT count(DISTINCT ev.session_id) FROM ev JOIN orders ord ON ord.id = ev.order_id
        WHERE ev.type = 'order_complete' AND ${VALID_ORDER}
      ) AS ordered
    FROM ev
  `);
  const row = rows[0];
  return {
    visited: num(row?.visited),
    viewedProduct: num(row?.viewed_product),
    addedToCart: num(row?.added_to_cart),
    startedCheckout: num(row?.started_checkout),
    ordered: num(row?.ordered),
  };
}

export async function getProducts(ex: Db, r: Range, f: Filters, limit: number): Promise<ProductRow[]> {
  const { rows } = await ex.execute<{ product_id: string; name: string; views: string; added: string; orders: string }>(sql`
    WITH ${qualifyingCte(r, f)}
    a AS (
      SELECT product_id,
        count(DISTINCT session_id) FILTER (WHERE type = 'product_view') AS views,
        count(DISTINCT session_id) FILTER (WHERE type IN ('add_to_cart', 'buy_now')) AS added
      FROM analytics_events
      WHERE ${inRange(r)} AND product_id IS NOT NULL
        AND type IN ('product_view', 'add_to_cart', 'buy_now')
        ${sessionFilter(sql`session_id`, f)}
      GROUP BY product_id
    ),
    b AS (
      SELECT oi."productId" AS product_id, count(DISTINCT ord.id) AS orders
      FROM analytics_events e
      JOIN orders ord ON ord.id = e.order_id
      JOIN order_items oi ON oi."orderId" = ord.id
      WHERE e.type = 'order_complete' AND ${inRange(r, sql`e.ts`)}
        ${sessionFilter(sql`e.session_id`, f)} AND ${VALID_ORDER}
      GROUP BY 1
    )
    SELECT a.product_id, p."productName" AS name, a.views, a.added, COALESCE(b.orders, 0) AS orders
    FROM a
    JOIN products p ON p.id = a.product_id
    LEFT JOIN b ON b.product_id = a.product_id
    ORDER BY a.views DESC, a.added DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    productId: row.product_id,
    name: row.name,
    views: num(row.views),
    addedToCart: num(row.added),
    orders: num(row.orders),
  }));
}

/** Visitors with any event in the last 5 minutes, and the page each last viewed. */
export async function getLive(ex: Db): Promise<LiveSnapshot> {
  const online = await ex.execute<{ online: string }>(sql`
    SELECT count(DISTINCT visitor_id) AS online FROM analytics_events
    WHERE ts > now() - interval '5 minutes'
  `);
  const pages = await ex.execute<{ path: string; visitors: string }>(sql`
    SELECT path, count(*) AS visitors
    FROM (
      SELECT DISTINCT ON (visitor_id) visitor_id, path FROM analytics_events
      WHERE type = 'page_view' AND ts > now() - interval '5 minutes'
      ORDER BY visitor_id, ts DESC
    ) latest
    GROUP BY path
    ORDER BY visitors DESC, path ASC
    LIMIT 10
  `);
  return {
    online: num(online.rows[0]?.online),
    pages: pages.rows.map((row) => ({ path: row.path, visitors: num(row.visitors) })),
  };
}
