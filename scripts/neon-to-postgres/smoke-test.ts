/**
 * Smoke test for the node-postgres data layer against a real database.
 *
 *   DATABASE_URL=<postgres url> npx tsx scripts/neon-to-postgres/smoke-test.ts
 *
 * Every write it attempts either fails by design or is rolled back, so it
 * leaves the database untouched and is safe to run against production right
 * before the cutover. Exits non-zero on the first failed check.
 */
import { eq, sql } from "drizzle-orm";
import { batch, db } from "@/db";
import { orders, products } from "@/db/schema";
import { isOrderNumberConflict } from "@/lib/order-number";
import { insufficientStockProductId, soldOutProductIds, stockDecrementQuery } from "@/lib/stock";

let failed = false;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) {
    failed = true;
    if (detail !== undefined) console.log("   ", detail);
  }
}

class Rollback extends Error {}

async function main() {
  const [product] = await db
    .select({ id: products.id, stock: products.stock })
    .from(products)
    .where(sql`${products.stock} > 0`)
    .limit(1);
  if (!product) throw new Error("need at least one product with stock > 0");

  // 1. batch returns each statement's result, in order, with raw execute
  //    results exposing `.rows` like neon-http's did.
  const [selectRows, executeResult] = await batch((tx) => [
    tx.select({ id: products.id }).from(products).where(eq(products.id, product.id)),
    tx.execute(sql`select 1 as one`),
  ]);
  check("batch returns ordered results", selectRows[0]?.id === product.id, selectRows);
  check("execute result has .rows", executeResult.rows?.[0]?.one === 1, executeResult);

  // 2. A failing statement rolls back the earlier ones in the same batch.
  let stockError: unknown;
  try {
    await batch((tx) => [
      tx.update(products).set({ stock: sql`${products.stock} + 1000` }).where(eq(products.id, product.id)),
      tx.execute(stockDecrementQuery([{ productId: product.id, quantity: 1_000_000_000 }])),
    ]);
  } catch (error) {
    stockError = error;
  }
  const [after] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, product.id));
  check("insufficient stock raises", insufficientStockProductId(stockError) === product.id, stockError);
  check("failed batch rolled back earlier writes", after?.stock === product.stock, { before: product.stock, after: after?.stock });

  // 3. Selling the last unit reports the product as sold out (read off the
  //    decrement result), then the transaction is rolled back.
  let soldOut: string[] = [];
  try {
    await db.transaction(async (tx) => {
      const result = await tx.execute(stockDecrementQuery([{ productId: product.id, quantity: product.stock }]));
      soldOut = soldOutProductIds(result);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  check("sold-out ids parsed from decrement result", soldOut.includes(product.id), soldOut);

  // 4. A duplicate order number is recognised as a retryable collision.
  const [existing] = await db.select().from(orders).limit(1);
  if (existing) {
    let conflict: unknown;
    try {
      await db.insert(orders).values({ ...existing, id: `smoke-${Date.now()}`, idempotencyKey: null });
    } catch (error) {
      conflict = error;
    }
    check("duplicate order number detected", isOrderNumberConflict(conflict), conflict);
  } else {
    console.log("- skipped duplicate order number check (no orders)");
  }
}

main()
  .catch((error) => {
    console.error(error);
    failed = true;
  })
  .finally(async () => {
    await (db.$client as { end(): Promise<void> }).end();
    process.exit(failed ? 1 : 0);
  });
