import { describe, expect, it } from "vitest";
import { buildPayload } from "./collector";
import { EMPTY_LANDING, type StoredSession } from "./session";

const session: StoredSession = {
  id: "s1",
  lastSeen: 1,
  landing: { ...EMPTY_LANDING, referrerHost: "youtube.com", utmSource: "youtube" },
};

describe("buildPayload", () => {
  it("combines the event with the session landing", () => {
    expect(buildPayload("page_view", "/shop/a", session, "v1", "sleepsheetbd.com")).toEqual({
      type: "page_view",
      path: "/shop/a",
      hostname: "sleepsheetbd.com",
      visitorId: "v1",
      sessionId: "s1",
      ...session.landing,
      label: null,
      productId: null,
      value: null,
    });
  });

  it("sends the pathname only", () => {
    expect(buildPayload("page_view", "/shop/a?utm_source=x#top", session, "v1", "h").path).toBe("/shop/a");
    expect(buildPayload("page_view", "", session, "v1", "h").path).toBe("/");
  });

  it("caps long labels and drops invalid values", () => {
    const p = buildPayload("add_to_cart", "/shop/a", session, "v1", "h", { label: "x".repeat(400), value: -3 });
    expect(p.label).toHaveLength(300);
    expect(p.value).toBeNull();
    expect(buildPayload("add_to_cart", "/", session, "v1", "h", { value: Number.NaN }).value).toBeNull();
    expect(buildPayload("add_to_cart", "/", session, "v1", "h", { value: 2450 }).value).toBe(2450);
  });
});
