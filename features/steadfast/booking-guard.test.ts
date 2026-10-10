import { describe, expect, it } from "vitest";
import { isAlreadyBooked } from "@/features/steadfast/booking-guard";

describe("isAlreadyBooked", () => {
  it("blocks an order that already has a tracking number", () => {
    expect(isAlreadyBooked({ trackingNumber: "SF123" })).toBe(true);
  });

  it("allows an order with no tracking number", () => {
    expect(isAlreadyBooked({ trackingNumber: null })).toBe(false);
    expect(isAlreadyBooked({ trackingNumber: "   " })).toBe(false);
  });

  it("allows an explicit re-book", () => {
    expect(isAlreadyBooked({ trackingNumber: "SF123" }, true)).toBe(false);
  });
});
