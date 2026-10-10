import { describe, it, expect } from "vitest";
import { orderBoughtPrice, orderDiscount, orderProfit, totalAfterSubtotalChange } from "@/lib/order-totals";

const base = {
  subtotal: 3840,
  deliveryCharge: 150,
  shippingCost: 150,
  totalAmount: 3990,
  refundedAmount: 0,
  items: [{ quantity: 1, costPrice: 2500 }],
};

describe("order totals", () => {
  it("computes profit as total minus bought price minus total delivery charge", () => {
    expect(orderProfit(base)).toBe(1340);
  });

  it("does not let an admin delivery extra change the discount, only the profit", () => {
    const order = { ...base, shippingCost: 195 };
    expect(orderDiscount(order)).toBe(0);
    expect(orderProfit(order)).toBe(1295);
  });

  it("treats a total below products + delivery charge as a discount", () => {
    const order = { ...base, totalAmount: 3900 };
    expect(orderDiscount(order)).toBe(90);
    expect(orderProfit(order)).toBe(1250);
  });

  it("subtracts refunds from profit", () => {
    expect(orderProfit({ ...base, refundedAmount: 500 })).toBe(840);
  });

  it("sums bought price across quantities and ignores missing cost", () => {
    expect(orderBoughtPrice({ items: [{ quantity: 2, costPrice: 1000 }, { quantity: 1, costPrice: null }] })).toBe(2000);
  });

  it("moves the total by an add-on price while keeping a discount", () => {
    expect(totalAfterSubtotalChange(3340, 3190, 3840)).toBe(3990);
    expect(totalAfterSubtotalChange(3290, 3190, 3840)).toBe(3940);
  });
});
