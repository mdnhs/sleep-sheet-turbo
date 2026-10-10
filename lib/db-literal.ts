import { sql, type SQL } from "drizzle-orm";

/**
 * A Postgres string literal (standard_conforming_strings is on, the default
 * since 9.1, so doubling single quotes is the whole escape).
 *
 * For expressions that appear in both SELECT and GROUP BY: a bound
 * parameter becomes $1 in one place and $2 in the other, and Postgres
 * won't treat them as the same grouped expression.
 */
export function pgStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** The channel label for a POS order with no Facebook page, e.g. "Nimbus Linen (POS)". */
export function posChannelSql(storeName: string): SQL {
  return sql.raw(pgStringLiteral(`${storeName} (POS)`));
}
