import { sql, type SQL } from "drizzle-orm";
import { activeFilters, DIMENSIONS, NONE, type Filters } from "../lib/dimensions";

export interface Range {
  start: Date;
  end: Date;
}

/** `AND <column> = <value>` for every active filter, columns from the fixed DIMENSIONS map. */
export function filterSql(filters: Filters): SQL {
  const parts = activeFilters(filters).map(([dim, value]) => {
    const column = sql.identifier(DIMENSIONS[dim]);
    return value === NONE ? sql`AND ${column} IS NULL` : sql`AND ${column} = ${value}`;
  });
  return parts.length ? sql.join(parts, sql` `) : sql``;
}

export function inRange(r: Range, column: SQL = sql`ts`): SQL {
  return sql`${column} >= ${r.start} AND ${column} <= ${r.end}`;
}

/** Sessions with at least one event in range matching every filter (spec §6). */
export function qualifyingSessions(r: Range, f: Filters): SQL {
  return sql`SELECT DISTINCT session_id FROM analytics_events WHERE ${inRange(r)} ${filterSql(f)}`;
}

// Same revenue rule as /analytics/sales-overview. Both expect `orders` aliased `ord`.
export const VALID_ORDER = sql.raw(`ord.status NOT IN ('CANCELLED', 'REFUNDED')`);
export const ORDER_AMOUNT = sql.raw(`ord."totalAmount" - COALESCE(ord."refundedAmount", 0)`);
