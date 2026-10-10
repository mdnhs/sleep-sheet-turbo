import { sql } from "drizzle-orm";
import type { db, Transaction } from "@/db";
import { ANALYTICS_TZ, type BucketUnit } from "../lib/buckets";
import type { Filters } from "../lib/dimensions";
import type { Kpis, SeriesPoint } from "../lib/types";
import { filterSql, inRange, ORDER_AMOUNT, qualifyingSessions, VALID_ORDER, type Range } from "./filters";

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
    WITH q AS (${qualifyingSessions(r, f)}),
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
        AND e.session_id IN (SELECT session_id FROM q) AND ${VALID_ORDER}
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
    WITH q AS (${qualifyingSessions(r, f)}),
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
          AND e.session_id IN (SELECT session_id FROM q) AND ${VALID_ORDER}
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
