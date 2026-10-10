import { describe, expect, it } from "vitest";
import { resolveGa4PropertyId } from "./ga4-property.js";

describe("resolveGa4PropertyId", () => {
  it("prefers the requested property", () => {
    expect(resolveGa4PropertyId("111", { GA4_PROPERTY_ID: "222" })).toBe("111");
  });

  it("falls back to GA4_PROPERTY_ID", () => {
    expect(resolveGa4PropertyId(undefined, { GA4_PROPERTY_ID: "222" })).toBe("222");
  });

  it("refuses rather than querying a hardcoded property", () => {
    expect(() => resolveGa4PropertyId(undefined, {})).toThrow(/GA4_PROPERTY_ID/);
  });
});
