import { describe, expect, it } from "vitest";
import { createCollectRoute, type CollectDeps } from "./collect";
import type { NewAnalyticsEvent } from "./store";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const valid = {
  type: "page_view",
  path: "/shop/premium-comforter",
  hostname: "sleepsheetbd.com",
  visitorId: "v1",
  sessionId: "s1",
  referrerHost: "youtube.com",
  utmSource: "youtube",
};

function setup(overrides: Partial<CollectDeps> = {}) {
  const rows: NewAnalyticsEvent[] = [];
  let sweeps = 0;
  const app = createCollectRoute({
    insert: async (row) => {
      rows.push(row);
    },
    isEnabled: async () => true,
    afterInsert: () => {
      sweeps++;
    },
    ...overrides,
  });
  // app.request() targets http://localhost, so a same-origin beacon carries
  // Origin: http://localhost.
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    app.request("/", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: {
        origin: "http://localhost",
        "user-agent": CHROME_MAC,
        "content-type": "application/json",
        "cf-ipcountry": "BD",
        "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.1`,
        ...headers,
      },
    });
  return { rows, post, sweeps: () => sweeps };
}

describe("POST /api/t", () => {
  it("stores a valid page view with derived fields", async () => {
    const { rows, post, sweeps } = setup();
    const res = await post(valid);
    expect(res.status).toBe(204);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "page_view",
      path: "/shop/premium-comforter",
      route: "/shop/[slug]",
      visitorId: "v1",
      sessionId: "s1",
      referrerHost: "youtube.com",
      utmSource: "youtube",
      country: "BD",
      browser: "Chrome 141",
      os: "macOS",
      device: "Desktop",
    });
    expect(sweeps()).toBe(1);
  });

  it("accepts the Referer when a browser sends no Origin", async () => {
    const { rows, post } = setup();
    await post(valid, { origin: "", referer: "http://localhost/shop" });
    expect(rows).toHaveLength(1);
  });

  it("ignores cross-origin beacons", async () => {
    const { rows, post } = setup();
    expect((await post(valid, { origin: "https://evil.example" })).status).toBe(204);
    expect(rows).toHaveLength(0);
  });

  it("ignores bots, dashboard paths and disabled tracking", async () => {
    const bot = setup();
    await bot.post(valid, { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" });
    expect(bot.rows).toHaveLength(0);

    const dashboard = setup();
    await dashboard.post({ ...valid, path: "/dashboard/orders" });
    expect(dashboard.rows).toHaveLength(0);

    const off = setup({ isEnabled: async () => false });
    await off.post(valid);
    expect(off.rows).toHaveLength(0);
  });

  it("answers 204 and stores nothing for malformed bodies", async () => {
    const { rows, post } = setup();
    for (const body of ["not json", { ...valid, type: "x" }, { ...valid, value: -1 }, { ...valid, path: "x" }]) {
      expect((await post(body)).status).toBe(204);
    }
    expect((await post({ ...valid, label: "x".repeat(5000) })).status).toBe(204);
    expect(rows).toHaveLength(0);
  });

  it("still answers 204 when the database write fails", async () => {
    const { post } = setup({
      insert: async () => {
        throw new Error('relation "analytics_events" does not exist');
      },
    });
    expect((await post(valid)).status).toBe(204);
  });
});
