import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// One pool per server instance. In dev, Next's hot reload re-evaluates this
// module, so the pool is parked on globalThis to avoid leaking a new set of
// connections on every edit.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL!,
    // One long-lived container on the VPS serves every request (storefront,
    // checkout, dashboard, /api/t beacons), so it needs more than the 5 a
    // Vercel function instance got. Postgres allows 100; DB_POOL_MAX overrides.
    max: Number(process.env.DB_POOL_MAX) || 15,
    // Close idle connections quickly so a suspended function doesn't hold
    // slots it no longer uses.
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

// Lets Vercel's Fluid compute release idle connections before an instance is
// suspended, instead of leaving them open until Postgres times them out.
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run several statements as one all-or-nothing unit and return their results
 * in order — the node-postgres stand-in for neon-http's `db.batch([...])`.
 *
 * Build every statement from `tx`, not `db`: drizzle query builders are lazy
 * and run on the connection they were built from, so only `tx`-built ones
 * execute inside the transaction. They are awaited one after another; any
 * failure (e.g. decrement_stock_or_fail raising) rolls back all of them.
 *
 *   const [[order], , stock] = await batch((tx) => [
 *     tx.insert(orders).values(...).returning(),
 *     tx.insert(orderItems).values(...),
 *     tx.execute(stockDecrementQuery(items)),
 *   ]);
 */
export function batch<const T extends readonly PromiseLike<unknown>[]>(
  build: (tx: Transaction) => T,
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  return db.transaction(async (tx) => {
    const results: unknown[] = [];
    for (const statement of build(tx)) results.push(await statement);
    return results as { -readonly [K in keyof T]: Awaited<T[K]> };
  });
}
