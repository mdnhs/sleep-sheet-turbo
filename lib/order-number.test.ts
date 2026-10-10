import { describe, it, expect, vi, afterEach } from "vitest";
import { generateOrderNumber, isOrderNumberConflict, withOrderNumber } from "./order-number";

const conflict = (constraint = "orders_orderNumber_unique") =>
  Object.assign(new Error(`duplicate key value violates unique constraint "${constraint}"`), {
    code: "23505",
    constraint,
  });

describe("generateOrderNumber", () => {
  it("formats as PREFIX-DDMMYY-XXXXXX", () => {
    expect(generateOrderNumber("ORD")).toMatch(/^ORD-\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(generateOrderNumber("POS")).toMatch(/^POS-\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/);
  });

  it("encodes today's date", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-06T10:00:00Z"));
    expect(generateOrderNumber("ORD")).toMatch(/^ORD-060926-/);
    vi.useRealTimers();
  });

  // The whole point of widening the suffix: 4 base36 chars collided at ~1,500
  // orders/day. A birthday check over one day's worth of numbers catches a
  // regression that shrinks the alphabet or the length back down.
  it("does not collide across a day's worth of orders", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateOrderNumber("ORD"));
    expect(seen.size).toBe(5000);
  });

  it("omits the ambiguous letters I, L, O and U", () => {
    const suffixes = Array.from({ length: 2000 }, () => generateOrderNumber("ORD").split("-")[2]);
    expect(suffixes.join("")).not.toMatch(/[ILOU]/);
  });
});

describe("isOrderNumberConflict", () => {
  it("matches a unique violation on orderNumber", () => {
    expect(isOrderNumberConflict(conflict())).toBe(true);
  });

  // The distinction that matters: an idempotencyKey conflict means "this order
  // already exists". Retrying it with a fresh order number would create the
  // duplicate the key exists to prevent.
  it("does not match the idempotencyKey conflict", () => {
    expect(isOrderNumberConflict(conflict("orders_idempotencyKey_unique"))).toBe(false);
  });

  it("does not match other errors", () => {
    expect(isOrderNumberConflict(new Error("INSUFFICIENT_STOCK:abc123"))).toBe(false);
    expect(isOrderNumberConflict({ code: "23503" })).toBe(false);
    expect(isOrderNumberConflict(null)).toBe(false);
  });

  it("falls back to the message when no constraint name is exposed", () => {
    expect(isOrderNumberConflict({
      code: "23505",
      message: 'duplicate key value violates unique constraint "orders_orderNumber_unique"',
    })).toBe(true);
  });

  it("unwraps a driver-wrapped cause", () => {
    expect(isOrderNumberConflict({
      cause: { code: "23505", constraint: "orders_orderNumber_unique" },
    })).toBe(true);
  });
});

describe("withOrderNumber", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes a generated number to the insert and returns its result", async () => {
    const result = await withOrderNumber("ORD", async (n) => `wrote ${n}`);
    expect(result).toMatch(/^wrote ORD-\d{6}-/);
  });

  it("retries with a fresh number after a collision", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const seen: string[] = [];
    const result = await withOrderNumber("ORD", async (n) => {
      seen.push(n);
      if (seen.length === 1) throw conflict();
      return n;
    });
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
    expect(result).toBe(seen[1]);
  });

  it("gives up after the attempt limit and rethrows the last conflict", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const insert = vi.fn(async () => { throw conflict(); });
    await expect(withOrderNumber("ORD", insert, 3)).rejects.toMatchObject({ code: "23505" });
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it("propagates a non-collision error on the first attempt", async () => {
    const insert = vi.fn(async () => { throw new Error("INSUFFICIENT_STOCK:abc123"); });
    await expect(withOrderNumber("ORD", insert)).rejects.toThrow("INSUFFICIENT_STOCK:abc123");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("does not retry an idempotencyKey conflict", async () => {
    const insert = vi.fn(async () => { throw conflict("orders_idempotencyKey_unique"); });
    await expect(withOrderNumber("ORD", insert)).rejects.toMatchObject({
      constraint: "orders_idempotencyKey_unique",
    });
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
