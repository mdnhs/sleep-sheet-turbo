import { describe, expect, it } from "vitest";
import { sameOrderNumber, toOrderSummary } from "@/features/order/server/track-order";

const row = {
  id: "ord_1",
  orderNumber: "ORD-1042",
  status: "SHIPPED",
  paymentMethod: "COD",
  totalAmount: 2500,
  subtotal: 2380,
  deliveryCharge: 120,
  shippingAddress: "House 12, Road 5, Mirpur 10, Dhaka",
  guestPhone: "01712345678",
  guestName: "Rahim Uddin",
  note: "Call before delivery",
  trackingNumber: "SF123456",
  createdAt: new Date("2026-10-01T10:00:00Z"),
  items: [
    { id: "it_1", quantity: 1, price: 2380, size: "King", color: null, product: { id: "p1", name: "Cotton Bedsheet", images: ["a.jpg"] } },
    { id: "it_2", quantity: 2, price: 0, size: null, color: null, product: null },
  ],
};

describe("toOrderSummary", () => {
  it("drops everything that identifies the customer or unlocks the order", () => {
    const json = JSON.stringify(toOrderSummary(row));
    for (const secret of ["ord_1", "ORD-1042", "Rahim", "Mirpur", "Call before", "SF123456", "01712345678"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("keeps what a customer needs to recognise the order", () => {
    expect(toOrderSummary(row)).toMatchObject({
      status: "SHIPPED",
      totalAmount: 2500,
      items: [{ id: "it_1", quantity: 1, product: { name: "Cotton Bedsheet" } }, { id: "it_2", product: null }],
    });
  });
});

describe("sameOrderNumber", () => {
  it("ignores case and spaces", () => {
    expect(sameOrderNumber("ORD-1042", " ord-1042 ")).toBe(true);
  });

  it("rejects a different number", () => {
    expect(sameOrderNumber("ORD-1042", "ORD-1043")).toBe(false);
  });
});
