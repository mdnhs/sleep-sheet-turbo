import { describe, expect, it } from "vitest";
import { canSettleCallback, matchesIssuedPayment, paymentIdRef } from "@/lib/bkash-reference";

describe("canSettleCallback", () => {
  const reference = paymentIdRef("TR0011abc");

  it("accepts the paymentID issued for this order", () => {
    expect(canSettleCallback(reference, "TR0011abc")).toBe(true);
  });

  it("rejects a missing paymentID", () => {
    expect(canSettleCallback(reference, undefined)).toBe(false);
    expect(canSettleCallback(reference, "")).toBe(false);
  });

  it("rejects another order's paymentID", () => {
    expect(canSettleCallback(reference, "TR0099zzz")).toBe(false);
  });

  it("rejects when no payment was ever issued", () => {
    expect(canSettleCallback(null, "TR0011abc")).toBe(false);
  });
});

describe("matchesIssuedPayment", () => {
  it("matches only the exact reference", () => {
    expect(matchesIssuedPayment(paymentIdRef("A"), "A")).toBe(true);
    expect(matchesIssuedPayment(paymentIdRef("A"), "B")).toBe(false);
  });
});
