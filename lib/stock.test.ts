import { describe, expect, it } from "vitest";
import { insufficientStockProductId, stockDecrementQuery } from "@/lib/stock";

describe("insufficientStockProductId", () => {
  it("extracts the productId from a decrement_stock_or_fail exception", () => {
    const err = new Error("INSUFFICIENT_STOCK:cmt76otop000104l5folo8xps");
    expect(insufficientStockProductId(err)).toBe("cmt76otop000104l5folo8xps");
  });

  it("extracts the productId when wrapped by a driver error with extra context", () => {
    const err = new Error(
      'NeonDbError: INSUFFICIENT_STOCK:cmabc123\nCONTEXT: PL/pgSQL function decrement_stock_or_fail(jsonb) line 15 at RAISE'
    );
    expect(insufficientStockProductId(err)).toBe("cmabc123");
  });

  it("returns null for unrelated errors", () => {
    expect(insufficientStockProductId(new Error("duplicate key value violates unique constraint"))).toBeNull();
  });

  it("returns null for non-Error values", () => {
    expect(insufficientStockProductId("some string")).toBeNull();
    expect(insufficientStockProductId(undefined)).toBeNull();
  });
});

// stockDecrementQuery returns a raw `sql` tagged-template SQL object (meant
// to be passed to db.execute() inside a db.batch([...])), not a query
// builder — its bound values live in .queryChunks, not .getSQL().params.
function boundPayload(query: { queryChunks: unknown[] }): unknown {
  const jsonChunk = query.queryChunks.find((chunk) => typeof chunk === "string");
  return JSON.parse(jsonChunk as string);
}

describe("stockDecrementQuery", () => {
  it("sums duplicate productIds into a single entry", () => {
    const query = stockDecrementQuery([
      { productId: "p1", quantity: 2 },
      { productId: "p1", quantity: 3 },
      { productId: "p2", quantity: 1 },
    ]);
    expect(boundPayload(query)).toEqual([
      { productId: "p1", quantity: 5 },
      { productId: "p2", quantity: 1 },
    ]);
  });

  it("skips items with an empty productId", () => {
    const query = stockDecrementQuery([{ productId: "", quantity: 2 }]);
    expect(boundPayload(query)).toEqual([]);
  });

  it("calls the decrement_stock_or_fail DB function", () => {
    const query = stockDecrementQuery([{ productId: "p1", quantity: 1 }]);
    const sqlText = query.queryChunks
      .map((chunk) => (typeof chunk === "string" ? "" : (chunk as { value: string[] }).value.join("")))
      .join("");
    expect(sqlText).toContain("decrement_stock_or_fail");
  });
});
