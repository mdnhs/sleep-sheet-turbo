import { sql, type SQL } from "drizzle-orm";
import { orders } from "@/db/schema";

/**
 * The status buckets the orders dashboard filters on.
 *
 * These were computed in the browser originally, because a bucket depends on
 * the courier's own `delivery_status` as well as this table's `status` column
 * and only the client had fetched the former. The courier value is persisted
 * on the row now (see the Steadfast route), so the server can define the sets
 * itself — which is what makes the list pageable at all: a set the server
 * cannot define is a set it cannot page through.
 *
 * Two properties are easy to get wrong here, and both misfile orders silently
 * rather than failing:
 *
 *   The buckets overlap. `isConfirmed` is true for a POS showroom sale before
 *   it considers delivery at all, so such an order appears under CONFIRMED
 *   and DELIVERED both. They are not a partition, and nothing should "fix"
 *   that by making them one.
 *
 *   NULL is not false. `courierStatus` is NULL for anything never synced, and
 *   `NULL IN (...)` evaluates to NULL — so `NOT (that)` is NULL too, which
 *   drops the row instead of keeping it. Every courier test is wrapped in
 *   `coalesce(..., false)` for exactly that reason.
 *
 * Extracted from the route handler so both properties are covered by tests
 * (features/order/server/status-buckets.test.ts) against a real Postgres
 * rather than asserted in a comment.
 */

/**
 * The courier status, but only where the dashboard would have had one.
 *
 * The client only ever held courier state for orders it would have fetched it
 * for — tracked, and not already finished. Mirroring that restriction here is
 * what keeps this classification identical to the one the page used to
 * compute; without it, a stale courier value on a completed order would start
 * moving rows between buckets.
 */
export const courierStatusSql: SQL = sql`(CASE WHEN ${orders.trackingNumber} IS NOT NULL AND ${orders.trackingNumber} <> ''
  AND ${orders.status} NOT IN ('DELIVERED','CANCELLED','REFUNDED')
  THEN ${orders.courierStatus} END)`;

export const isCancelledSql: SQL = sql`(${orders.status} = 'CANCELLED'
  OR coalesce(${courierStatusSql} IN ('cancelled','cancelled_approval_pending'), false))`;

export const isReturnedSql: SQL = sql`(${orders.status} = 'REFUNDED'
  OR coalesce(${orders.refundedAmount}, 0) > 0
  OR coalesce(${courierStatusSql} IN ('returned','partial-return','not_delivered','partial-not-delivered'), false))`;

export const hasBoughtPriceSql: SQL = sql`EXISTS (
  SELECT 1 FROM order_items
  WHERE order_items."orderId" = ${orders.id}
    AND order_items."costPrice" IS NOT NULL
    AND order_items."costPrice" > 0
)`;

export const hasSteadfastBookingSql: SQL = sql`(${orders.trackingNumber} IS NOT NULL AND ${orders.trackingNumber} <> '')`;

export const isDeliveredSql: SQL = sql`(NOT ${isCancelledSql} AND NOT ${isReturnedSql}
  AND ${hasBoughtPriceSql}
  AND (${orders.status} = 'DELIVERED'
    OR coalesce(${courierStatusSql} IN ('delivered','partial_delivered','delivered_approval_pending','partial_delivered_approval_pending'), false)))`;

export const isConfirmedSql: SQL = sql`(NOT ${isCancelledSql} AND NOT ${isReturnedSql}
  AND ((${orders.saleType} = 'POS'
        AND (${orders.status} = 'DELIVERED'
             OR coalesce(${orders.shippingAddress} ILIKE '%In-store pickup%', false)))
    OR (${hasBoughtPriceSql} AND ${hasSteadfastBookingSql})))`;

export const isPendingSql: SQL = sql`(NOT ${isCancelledSql} AND NOT ${isReturnedSql}
  AND NOT ${isConfirmedSql} AND NOT ${isDeliveredSql})`;

/**
 * Dhaka local timezone is Asia/Dhaka (UTC+6).
 * In getTimezoneOffset() convention, UTC+6 is -360 minutes.
 * Bangladesh operates on standard UTC+6 without Daylight Saving Time.
 */
export const DHAKA_TZ_OFFSET_MINUTES = -360;

/**
 * The instants bracketing Dhaka's local day (Asia/Dhaka, UTC+6).
 *
 * Always follows Dhaka's local calendar day regardless of server hosting location
 * or caller environment, ensuring all orders strictly align with Bangladesh business hours.
 */
export function todayRange(_tzOffset?: string | undefined, now = Date.now()): { from: Date; to: Date } {
  // Always enforce Dhaka local time (UTC+6)
  const offsetMin = DHAKA_TZ_OFFSET_MINUTES;
  const shift = offsetMin * 60_000;
  const dayStart = new Date(now - shift);
  dayStart.setUTCHours(0, 0, 0, 0);
  const from = new Date(dayStart.getTime() + shift);
  return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
}

export function isTodaySqlFor(range: { from: Date; to: Date }): SQL {
  const fromIso = range.from instanceof Date ? range.from.toISOString() : String(range.from);
  const toIso = range.to instanceof Date ? range.to.toISOString() : String(range.to);
  return sql`(NOT ${isCancelledSql} AND NOT ${isReturnedSql}
    AND ${hasBoughtPriceSql}
    AND (
      (${orders.saleType} = 'POS' AND coalesce(${orders.shippingAddress} ILIKE '%In-store pickup%', false))
      OR ${hasSteadfastBookingSql}
    )
    AND ${orders.confirmedAt} IS NOT NULL
    AND ${orders.confirmedAt} >= ${fromIso}::timestamp
    AND ${orders.confirmedAt} < ${toIso}::timestamp)`;
}

/** The bucket a `status` filter value selects, or undefined for "all". */
export function bucketFor(status: string | undefined, todaySql: SQL): SQL | undefined {
  switch (status) {
    case "PENDING": return isPendingSql;
    case "CONFIRMED": return isConfirmedSql;
    case "DELIVERED": return isDeliveredSql;
    case "CANCELLED": return isCancelledSql;
    case "RETURNED": return isReturnedSql;
    case "TODAY": return todaySql;
    default: return undefined;
  }
}
