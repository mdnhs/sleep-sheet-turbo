import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { runAnalyticsQuery } from "./runner";

// Local Docker Postgres only:
//   set -a && source .env && set +a && RUN_DB_TESTS=1 pnpm vitest run features/web-analytics/server/runner.db.test.ts
const RUN = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!RUN)("runAnalyticsQuery (database)", () => {
  it("returns the query's result", async () => {
    const { rows } = await runAnalyticsQuery((tx) => tx.execute<{ one: number }>(sql`SELECT 1 AS one`));
    expect(rows[0].one).toBe(1);
  });

  it("cancels a query that runs past the statement timeout", async () => {
    await expect(runAnalyticsQuery((tx) => tx.execute(sql`SELECT pg_sleep(1)`), "100ms")).rejects.toThrow();
    // The pool connection is usable again afterwards.
    const { rows } = await runAnalyticsQuery((tx) => tx.execute<{ one: number }>(sql`SELECT 1 AS one`));
    expect(rows[0].one).toBe(1);
  });

  it("refuses writes", async () => {
    await expect(
      runAnalyticsQuery((tx) => tx.execute(sql`CREATE TEMP TABLE wa_runner_check (x int)`)),
    ).rejects.toThrow();
  });
});
