import { describe, expect, it } from "vitest";
import { toCollectExtra } from "./traffic-tracker";

describe("toCollectExtra", () => {
  it("uses price × quantity as the value", () => {
    expect(toCollectExtra("Comforter", { productId: "p1", price: 2450, quantity: 2 })).toEqual({
      label: "Comforter",
      productId: "p1",
      value: 4900,
    });
  });

  it("defaults the quantity to one and tolerates missing meta", () => {
    expect(toCollectExtra("Comforter", { productId: "p1", price: 2450 }).value).toBe(2450);
    expect(toCollectExtra(undefined, undefined)).toEqual({ label: null, productId: null, value: null });
  });
});
