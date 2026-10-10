import { describe, expect, it } from "vitest";
import { breakdownQuerySchema, rangeQuerySchema, toRangeAndFilters } from "./query-params";

const from = "2026-10-01T00:00:00.000Z";
const to = "2026-10-07T23:59:59.999Z";

describe("rangeQuerySchema", () => {
  it("accepts ISO datetimes and known filters", () => {
    expect(rangeQuerySchema.safeParse({ from, to, referrer: "youtube.com" }).success).toBe(true);
  });

  it("rejects non-ISO dates", () => {
    expect(rangeQuerySchema.safeParse({ from: "yesterday", to }).success).toBe(false);
  });
});

describe("breakdownQuerySchema", () => {
  it("only accepts known dimensions and caps the limit", () => {
    expect(breakdownQuerySchema.safeParse({ from, to, dim: "referrer" }).success).toBe(true);
    expect(breakdownQuerySchema.safeParse({ from, to, dim: "password" }).success).toBe(false);
    expect(breakdownQuerySchema.safeParse({ from, to, dim: "path", limit: "500" }).success).toBe(false);
    expect(breakdownQuerySchema.parse({ from, to, dim: "path" }).limit).toBe(10);
  });
});

describe("toRangeAndFilters", () => {
  it("builds the range and keeps only non-empty filters", () => {
    const result = toRangeAndFilters(rangeQuerySchema.parse({ from, to, referrer: "youtube.com", country: "" }));
    expect(result).toEqual({
      range: { start: new Date(from), end: new Date(to) },
      filters: { referrer: "youtube.com" },
    });
  });

  it("rejects an inverted range or one longer than 400 days", () => {
    expect(toRangeAndFilters(rangeQuerySchema.parse({ from: to, to: from }))).toBeNull();
    expect(
      toRangeAndFilters(rangeQuerySchema.parse({ from: "2024-01-01T00:00:00.000Z", to })),
    ).toBeNull();
  });
});
