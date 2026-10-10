import { describe, expect, it, vi } from "vitest";
import { analyticsIdSchema, recordOrderEvent, type OrderEventDeps } from "./record-order-event";
import type { AnalyticsEvent, NewAnalyticsEvent } from "./store";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const headers = () => new Headers({ "user-agent": IPHONE, "cf-ipcountry": "BD" });

function lastEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    id: 1,
    ts: new Date(),
    type: "checkout_start",
    visitorId: "v1",
    sessionId: "s1",
    path: "/checkout",
    route: "/checkout",
    hostname: "sleepsheetbd.com",
    referrerHost: "youtube.com",
    utmSource: "youtube",
    utmMedium: "cpc",
    utmCampaign: "oct",
    utmTerm: null,
    utmContent: null,
    adClick: "google",
    country: "IN",
    device: "Desktop",
    browser: "Chrome 141",
    os: "Windows 10/11",
    label: null,
    productId: null,
    value: null,
    orderId: null,
    ...overrides,
  };
}

function setup(overrides: Partial<OrderEventDeps> = {}) {
  const rows: NewAnalyticsEvent[] = [];
  const deps: OrderEventDeps = {
    isEnabled: async () => true,
    findLast: async () => lastEvent(),
    insert: async (row) => {
      rows.push(row);
    },
    ...overrides,
  };
  return { rows, deps };
}

describe("recordOrderEvent", () => {
  it("copies the session's landing from its last event", async () => {
    const { rows, deps } = setup();
    await recordOrderEvent({ orderId: "ord1", value: 2450, visitorId: "v1", sessionId: "s1", headers: headers() }, deps);
    expect(rows).toEqual([
      expect.objectContaining({
        type: "order_complete",
        orderId: "ord1",
        value: 2450,
        visitorId: "v1",
        sessionId: "s1",
        path: "/checkout",
        route: "/checkout",
        referrerHost: "youtube.com",
        utmSource: "youtube",
        utmCampaign: "oct",
        adClick: "google",
        country: "IN",
        device: "Desktop",
      }),
    ]);
  });

  it("falls back to the request when the client sent no session", async () => {
    const findLast = vi.fn(async () => lastEvent());
    const { rows, deps } = setup({ findLast });
    await recordOrderEvent({ orderId: "ord2", value: 900, headers: headers() }, deps);
    expect(findLast).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({
      sessionId: "srv-ord2",
      visitorId: "srv-ord2",
      path: "/checkout",
      referrerHost: null,
      country: "BD",
      device: "Mobile",
      os: "iOS",
    });
  });

  it("writes nothing while tracking is off", async () => {
    const findLast = vi.fn(async () => lastEvent());
    const { rows, deps } = setup({ isEnabled: async () => false, findLast });
    await recordOrderEvent({ orderId: "ord3", value: 1, sessionId: "s1", headers: headers() }, deps);
    expect(rows).toHaveLength(0);
    expect(findLast).not.toHaveBeenCalled();
  });

  it("never rejects, even when the database fails", async () => {
    const { deps } = setup({
      insert: async () => {
        throw new Error("connection refused");
      },
    });
    await expect(
      recordOrderEvent({ orderId: "ord4", value: 1, sessionId: "s1", headers: headers() }, deps),
    ).resolves.toBeUndefined();
  });
});

describe("analyticsIdSchema", () => {
  it("trims valid ids and turns bad values into undefined instead of failing", () => {
    expect(analyticsIdSchema.parse(" abc ")).toBe("abc");
    expect(analyticsIdSchema.parse("x".repeat(500))).toBeUndefined();
    expect(analyticsIdSchema.parse(123)).toBeUndefined();
    expect(analyticsIdSchema.parse(undefined)).toBeUndefined();
  });
});
