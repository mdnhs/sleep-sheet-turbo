import { describe, expect, it } from "vitest";
import { toRoute } from "./route-pattern";

describe("toRoute", () => {
  it("collapses one dynamic segment to its route pattern", () => {
    expect(toRoute("/shop/premium-comforter")).toBe("/shop/[slug]");
    expect(toRoute("/blog/how-to-wash")).toBe("/blog/[slug]");
    expect(toRoute("/categories/bedsheet")).toBe("/categories/[value]");
    expect(toRoute("/videos/share/abc123")).toBe("/videos/share/[slug]");
    expect(toRoute("/orders/ord_1")).toBe("/orders/[orderId]");
  });

  it("leaves static pages and the listing pages alone", () => {
    expect(toRoute("/")).toBe("/");
    expect(toRoute("/shop")).toBe("/shop");
    expect(toRoute("/checkout")).toBe("/checkout");
  });

  it("ignores a trailing slash", () => {
    expect(toRoute("/shop/")).toBe("/shop");
    expect(toRoute("/shop/a/")).toBe("/shop/[slug]");
  });

  it("does not collapse deeper paths", () => {
    expect(toRoute("/shop/a/b")).toBe("/shop/a/b");
  });
});
