import { describe, expect, it } from "vitest";
import { findFreeDelivery, isPromotionLive, personalEndsAt, type PromotionRule } from "./promotions";

const NOW = new Date("2026-10-12T12:00:00Z");

function promo(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return {
    id: "p1",
    title: "bKash free delivery",
    isActive: true,
    paymentMethods: ["bkash"],
    zones: ["inside_dhaka", "outside_dhaka"],
    minOrderAmount: null,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

const ctx = { paymentMethod: "bkash", zone: "inside_dhaka", subtotal: 3000, now: NOW };

describe("isPromotionLive", () => {
  it("is live when switched on with no dates", () => {
    expect(isPromotionLive(promo(), NOW)).toBe(true);
  });

  it("is off when switched off", () => {
    expect(isPromotionLive(promo({ isActive: false }), NOW)).toBe(false);
  });

  it("respects the start and end, inclusive, from Date or ISO string", () => {
    expect(isPromotionLive(promo({ startsAt: "2026-10-13T00:00:00Z" }), NOW)).toBe(false);
    expect(isPromotionLive(promo({ endsAt: new Date("2026-10-11T00:00:00Z") }), NOW)).toBe(false);
    expect(isPromotionLive(promo({ startsAt: NOW, endsAt: NOW.toISOString() }), NOW)).toBe(true);
  });
});

describe("findFreeDelivery", () => {
  it("matches on payment method", () => {
    expect(findFreeDelivery([promo()], ctx)?.id).toBe("p1");
    expect(findFreeDelivery([promo()], { ...ctx, paymentMethod: "cod" })).toBeNull();
  });

  it("matches on zone", () => {
    expect(findFreeDelivery([promo({ zones: ["outside_dhaka"] })], ctx)).toBeNull();
  });

  it("needs the subtotal to reach the minimum", () => {
    expect(findFreeDelivery([promo({ minOrderAmount: 3000 })], ctx)?.id).toBe("p1");
    expect(findFreeDelivery([promo({ minOrderAmount: 3001 })], ctx)).toBeNull();
  });

  it("skips promotions that are not live", () => {
    expect(findFreeDelivery([promo({ isActive: false })], ctx)).toBeNull();
    expect(findFreeDelivery([promo({ endsAt: "2026-10-01T00:00:00Z" })], ctx)).toBeNull();
  });

  it("returns the first match from several", () => {
    const list = [promo({ id: "cod", paymentMethods: ["cod"] }), promo({ id: "a" }), promo({ id: "b" })];
    expect(findFreeDelivery(list, ctx)?.id).toBe("a");
  });

  it("returns null for no promotions", () => {
    expect(findFreeDelivery([], ctx)).toBeNull();
  });
});

describe("personalEndsAt", () => {
  const seen = new Date("2026-10-12T10:00:00Z");

  it("is first seen + the window", () => {
    expect(personalEndsAt({ endsAt: "2026-10-31T00:00:00Z", personalWindowMinutes: 120 }, seen)?.toISOString()).toBe(
      "2026-10-12T12:00:00.000Z",
    );
  });

  it("never runs past the promotion's own end", () => {
    expect(personalEndsAt({ endsAt: "2026-10-12T11:00:00Z", personalWindowMinutes: 120 }, seen)?.toISOString()).toBe(
      "2026-10-12T11:00:00.000Z",
    );
  });

  it("works without a promotion end", () => {
    expect(personalEndsAt({ endsAt: null, personalWindowMinutes: 30 }, seen)?.toISOString()).toBe("2026-10-12T10:30:00.000Z");
  });

  it("is the promotion's own end (or none) without a window", () => {
    expect(personalEndsAt({ endsAt: "2026-10-31T00:00:00.000Z", personalWindowMinutes: null }, seen)?.toISOString()).toBe(
      "2026-10-31T00:00:00.000Z",
    );
    expect(personalEndsAt({ endsAt: null, personalWindowMinutes: null }, seen)).toBeNull();
  });

  it("feeds isPromotionLive: live inside the window, over after it", () => {
    const end = personalEndsAt({ endsAt: null, personalWindowMinutes: 60 }, seen);
    const base = { isActive: true, startsAt: null, endsAt: end };
    expect(isPromotionLive(base, new Date("2026-10-12T10:59:00Z"))).toBe(true);
    expect(isPromotionLive(base, new Date("2026-10-12T11:01:00Z"))).toBe(false);
  });
});
