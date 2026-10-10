import { sql } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import { createLimiter } from "./limiter";

// The dashboard fires about ten aggregation queries per load, and they share
// the app's connection pool with the storefront and checkout. Two guards keep
// a heavy range (90 days, a year) from starving those:
// - at most two analytics queries hold a connection at a time;
// - each runs in a read-only transaction with a statement timeout, so a slow
//   one gives its connection back instead of holding it.
const MAX_CONCURRENT = 2;
const STATEMENT_TIMEOUT = "10s";

const limit = createLimiter(MAX_CONCURRENT);

export function runAnalyticsQuery<T>(
  query: (tx: Transaction) => Promise<T>,
  timeout: string = STATEMENT_TIMEOUT,
): Promise<T> {
  return limit(() =>
    db.transaction(
      async (tx) => {
        // SET doesn't accept a bound parameter; set_config does.
        await tx.execute(sql`SELECT set_config('statement_timeout', ${timeout}, true)`);
        return query(tx);
      },
      { accessMode: "read only" },
    ),
  );
}
