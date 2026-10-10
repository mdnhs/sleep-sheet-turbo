import { describe, expect, it } from "vitest";
import { withoutCostPrices } from "@/features/order/server/customer-order";

const order = {
  orderNumber: "ORD-1",
  items: [
    { id: "i1", price: 1500, costPrice: 900, product: { name: "Sheet", addOns: [{ name: "Pillow cover", price: 200, costPrice: 80 }] } },
    { id: "i2", price: 500, costPrice: null, product: null },
  ],
};

describe("withoutCostPrices", () => {
  it("blanks line-item and add-on cost prices", () => {
    const out = withoutCostPrices(order);
    expect(out.items[0].costPrice).toBeNull();
    expect(JSON.stringify(out)).not.toContain("900");
    expect(JSON.stringify(out)).not.toContain('"costPrice":80');
  });

  it("keeps selling prices and everything else", () => {
    const out = withoutCostPrices(order);
    expect(out.orderNumber).toBe("ORD-1");
    expect(out.items[0].price).toBe(1500);
    expect(out.items[0].product?.addOns[0]).toEqual({ name: "Pillow cover", price: 200 });
    expect(out.items[1].product).toBeNull();
  });

  it("does not mutate the input", () => {
    withoutCostPrices(order);
    expect(order.items[0].costPrice).toBe(900);
    expect(order.items[0].product?.addOns[0].costPrice).toBe(80);
  });
});
