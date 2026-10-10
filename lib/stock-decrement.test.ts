import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { soldOutProductIds } from "./stock";

// The decrement is a plpgsql function, so it is exercised as one — the same
// migration SQL that ships, run against a real Postgres. Its two jobs are
// refusing to oversell and reporting what it took to zero, and both are about
// SQL behaviour that a mock cannot stand in for.
let db: PGlite;

const migration = readFileSync(
  "db/migrations/0019_stock_decrement_reports_sold_out.sql",
  "utf8",
);

/** Run the function the way the app does, and shape the result like the driver. */
async function decrement(items: { productId: string; quantity: number }[]) {
  const res = await db.query<{ decrement_stock_or_fail: unknown }>(
    "select decrement_stock_or_fail($1::jsonb)",
    [JSON.stringify(items)],
  );
  return res;
}

async function stockOf(id: string) {
  const res = await db.query<{ productStock: number }>(
    'select "productStock" from products where id = $1',
    [id],
  );
  return res.rows[0]?.productStock;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create table products (id text primary key, "productStock" int not null)`);
  // Strip drizzle's statement separator; PGlite runs the file as one script.
  await db.exec(migration.replace(/-->\s*statement-breakpoint/g, ""));
});

afterAll(async () => { await db.close(); });

beforeEach(async () => {
  await db.exec(`truncate products`);
  await db.exec(`insert into products (id, "productStock") values
    ('p1', 10), ('p2', 3), ('p3', 1)`);
});

describe("decrement_stock_or_fail", () => {
  it("decrements the stock it is given", async () => {
    await decrement([{ productId: "p1", quantity: 4 }]);
    expect(await stockOf("p1")).toBe(6);
  });

  it("reports nothing sold out when stock remains", async () => {
    const res = await decrement([{ productId: "p1", quantity: 4 }]);
    expect(soldOutProductIds(res)).toEqual([]);
  });

  it("reports the product when a sale lands exactly on zero", async () => {
    const res = await decrement([{ productId: "p3", quantity: 1 }]);
    expect(soldOutProductIds(res)).toEqual(["p3"]);
    expect(await stockOf("p3")).toBe(0);
  });

  it("reports every product a multi-line order zeroes", async () => {
    const res = await decrement([
      { productId: "p1", quantity: 1 },
      { productId: "p2", quantity: 3 },
      { productId: "p3", quantity: 1 },
    ]);
    expect(soldOutProductIds(res).sort()).toEqual(["p2", "p3"]);
  });

  // The regression the ROW_COUNT check guards: a sale landing on zero must
  // not look like a sale that found no stock.
  it("does not treat a sale down to zero as insufficient stock", async () => {
    await expect(decrement([{ productId: "p2", quantity: 3 }])).resolves.toBeTruthy();
    expect(await stockOf("p2")).toBe(0);
  });

  // And the other half: a stale `remaining` from the previous loop pass must
  // not leak into the next item's decision.
  it("keeps per-item results independent across a multi-line order", async () => {
    const res = await decrement([
      { productId: "p3", quantity: 1 },  // zeroes
      { productId: "p1", quantity: 1 },  // does not
    ]);
    expect(soldOutProductIds(res)).toEqual(["p3"]);
  });

  it("raises with the product id when stock is short", async () => {
    await expect(decrement([{ productId: "p2", quantity: 4 }]))
      .rejects.toThrow(/INSUFFICIENT_STOCK:p2/);
  });

  it("rolls the whole order back when any line is short", async () => {
    await expect(decrement([
      { productId: "p1", quantity: 1 },
      { productId: "p2", quantity: 99 },
    ])).rejects.toThrow(/INSUFFICIENT_STOCK:p2/);
    // The function runs as a single statement, so the earlier line's
    // decrement is undone with it — nothing is sold without the rest.
    expect(await stockOf("p1")).toBe(10);
  });

  it("raises for an unknown product rather than silently skipping it", async () => {
    await expect(decrement([{ productId: "nope", quantity: 1 }]))
      .rejects.toThrow(/INSUFFICIENT_STOCK:nope/);
  });

  it("accepts an empty item list", async () => {
    const res = await decrement([]);
    expect(soldOutProductIds(res)).toEqual([]);
  });
});

describe("soldOutProductIds", () => {
  // Runs after the order has already committed, so a surprising result shape
  // must not turn a completed sale into a failed request.
  it("returns an empty list for anything unexpected", () => {
    expect(soldOutProductIds(undefined)).toEqual([]);
    expect(soldOutProductIds(null)).toEqual([]);
    expect(soldOutProductIds({})).toEqual([]);
    expect(soldOutProductIds({ rows: [] })).toEqual([]);
    expect(soldOutProductIds({ rows: [{}] })).toEqual([]);
    expect(soldOutProductIds({ rows: [{ decrement_stock_or_fail: null }] })).toEqual([]);
  });

  it("drops non-string entries", () => {
    expect(soldOutProductIds({ rows: [{ decrement_stock_or_fail: ["p1", 2, null] }] }))
      .toEqual(["p1"]);
  });
});
