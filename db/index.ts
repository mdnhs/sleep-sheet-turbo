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
    // On a 1-core VPS, 15 connections multiplexes thousands of async queries
    // without overloading the single CPU with context-switching overhead.
    max: Number(process.env.DB_POOL_MAX) || 15,
    // Keep idle connections warm for 30s to eliminate connection setup churn.
    idleTimeoutMillis: 30_000,
    // Fail fast if pool is saturated instead of hanging request for 10s.
    connectionTimeoutMillis: 5_000,
    // Statement timeout: terminate runaway queries after 10s to prevent pool starvation.
    statement_timeout: 10_000,
    query_timeout: 10_000,
  });

// Catch idle client errors so unexpected connection drops don't crash the server.
pool.on("error", (err) => {
  console.error("Unexpected error on idle database client:", err);
});

// Guard against idle transactions holding row/table locks indefinitely.
pool.on("connect", (client) => {
  client.query("SET idle_in_transaction_session_timeout = '10s'").catch(() => {});
});

// Singleton pool across all environments (production & dev) to prevent duplicate pools.
globalForDb.pgPool = pool;

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
