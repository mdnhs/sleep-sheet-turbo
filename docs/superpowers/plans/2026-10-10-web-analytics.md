# First-party Web Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vercel-Analytics-style dashboard in the admin panel (visitors, page views, bounce rate, trend chart, pages/referrers/UTM/countries/devices, funnel, products, live visitors, order attribution) built on the store's own Postgres, with an admin on/off switch.

**Architecture:** The storefront's existing `trackEvent` also sends a `sendBeacon` to a new public Hono route `POST /api/t`, which validates, filters bots, enriches (UA, `cf-ipcountry`, route pattern) and inserts into one `analytics_events` table. Checkout records `order_complete` server-side so revenue joins `orders`. A gated `GET /api/web-analytics/*` route runs SQL aggregations for a new "Website" tab on `/dashboard/analytics`.

**Tech Stack:** Next.js 16 (App Router), Hono 4 + `@hono/zod-validator`, zod 4, Drizzle ORM (node-postgres) on Postgres 18, TanStack Query, nuqs 2, recharts 3 + shadcn chart, Base UI components, date-fns 4, vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-10-web-analytics-design.md`

## Global Constraints

- No new npm dependencies. `package.json` dependencies must not change.
- Never run `drizzle-kit migrate` or `drizzle-kit push`. Migrations are applied with `psql`; production only after the owner confirms (see `db/migrations/README.md`).
- No IP address is ever stored. `POST /api/t` answers `204` (or `429` from the rate limiter) and never echoes input.
- Only `page_view`, `product_view`, `add_to_cart`, `buy_now`, `checkout_start` come from the browser. `order_complete` is written only by the server.
- Session idle timeout: 30 minutes. Retention: 365 days. "Online" window: 5 minutes. Live poll: every 30 s.
- Tracking is on unless `site_settings.analytics_enabled` is exactly `"false"`.
- Revenue = `"totalAmount" - COALESCE("refundedAmount", 0)`, excluding orders with status `CANCELLED` or `REFUNDED`.
- Buckets are truncated in `Asia/Dhaka`: hourly when the range is ≤ 2 days, daily ≤ 92 days, monthly beyond.
- The collector must never throw, never block input handling, and never wait on GTM/gtag.
- Dashboard endpoints are gated by `canViewAnalytics`; the toggle needs `settings:write`.
- Work on `main` (no branches). Commit at the end of each task; push only when the owner says so.

## Review Focus

- Storage blocked (Safari private mode, storage disabled): the collector still sends, using an in-memory session, and never throws. Pinned in Task 2 (`loadSession`/`saveSession` with a throwing storage).
- Hostile or malformed beacons (not JSON, over 2 KB, unknown `type`, negative `value`, path without a leading `/`, cross-origin): `204` and nothing stored. Pinned in Task 4.
- Database down or table missing during rollout: `/api/t` still answers `204` and checkout still succeeds. Pinned in Task 4 (insert throws) and Task 6 (`recordOrderEvent` insert throws).
- Internal navigation, `www.` and upper-case variants of the store's own host must never show up as a referrer. Pinned in Task 2.
- Day boundaries in Dhaka time: a visit at 23:30 Dhaka belongs to that Dhaka day, and month buckets start on the 1st even after 31-day months. Pinned in Task 7.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `features/web-analytics/lib/route-pattern.ts` | `toRoute(path)` | 1 |
| `features/web-analytics/lib/request-info.ts` | `isBot(ua)`, `countryFromHeader(v)` | 1 |
| `features/web-analytics/lib/buckets.ts` | `bucketUnit`, `ANALYTICS_TZ` | 1 |
| `features/web-analytics/lib/session.ts` | session + landing rules, storage helpers (pure) | 2 |
| `db/schema.ts`, `db/migrations/0031_*.sql` | `analytics_events` table | 3 |
| `features/web-analytics/lib/types.ts` | shared payload/result types | 4, 7 |
| `features/web-analytics/server/payload.ts` | beacon body parsing/validation | 4 |
| `features/web-analytics/server/store.ts` | insert / enabled flag / last session event | 4 |
| `features/web-analytics/server/collect.ts` | `POST /api/t` | 4 |
| `lib/data-retention.ts` | 365-day sweep | 4 |
| `features/web-analytics/lib/collector.ts` | browser collector (`collect`, `getAnalyticsIds`) | 5 |
| `lib/traffic-tracker.ts`, `components/traffic-tracker.tsx`, `app/(client)/checkout/checkout-client.tsx` | wiring | 5 |
| `features/web-analytics/server/record-order-event.ts` | server `order_complete` | 6 |
| `features/checkout/server/route.ts`, `features/checkout/api/use-checkout.ts` | attribution wiring | 6 |
| `features/web-analytics/lib/dimensions.ts` | dimensions, filters (client-safe) | 7 |
| `features/web-analytics/server/filters.ts` | SQL fragments | 7 |
| `features/web-analytics/server/queries.ts` | all aggregations | 7, 8 |
| `lib/analytics-access.ts` | shared `canViewAnalytics` | 9 |
| `features/web-analytics/server/query-params.ts` | dashboard query validation | 9 |
| `features/web-analytics/server/route.ts` | `GET /api/web-analytics/*` | 9 |
| `features/web-analytics/api/use-web-analytics.ts` | React Query hooks | 9 |
| `features/web-analytics/lib/format.ts` | metric/label/range helpers | 10 |
| `features/web-analytics/components/*` | dashboard UI | 10, 11 |
| `app/(dashboard)/dashboard/analytics/{page.tsx,analytics-tabs.tsx}` | Website / GA4 tabs | 10 |

Commands used throughout:

- Unit tests: `pnpm vitest run <path>`
- DB tests (local Docker Postgres): `set -a && source .env && set +a && RUN_DB_TESTS=1 pnpm vitest run <path>`
- Types: `npx tsc --noEmit -p .`

---

### Task 1: Route patterns, bot/country detection, bucket units

**Files:**
- Create: `features/web-analytics/lib/route-pattern.ts`
- Create: `features/web-analytics/lib/request-info.ts`
- Create: `features/web-analytics/lib/buckets.ts`
- Test: `features/web-analytics/lib/route-pattern.test.ts`, `features/web-analytics/lib/request-info.test.ts`, `features/web-analytics/lib/buckets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `toRoute(path: string): string`; `isBot(userAgent: string | null | undefined): boolean`; `countryFromHeader(value: string | null | undefined): string | null`; `type BucketUnit = "hour" | "day" | "month"`; `ANALYTICS_TZ = "Asia/Dhaka"`; `bucketUnit(start: Date, end: Date): BucketUnit`.

- [ ] **Step 1: Write the failing tests**

`features/web-analytics/lib/route-pattern.test.ts`:

```ts
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
```

`features/web-analytics/lib/request-info.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { countryFromHeader, isBot } from "./request-info";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const FACEBOOK_IN_APP =
  "Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/485.0.0.70.77;]";

describe("isBot", () => {
  it("lets real browsers through, including Facebook's in-app browser", () => {
    expect(isBot(CHROME_MAC)).toBe(false);
    expect(isBot(IPHONE_SAFARI)).toBe(false);
    expect(isBot(FACEBOOK_IN_APP)).toBe(false);
  });

  it("flags crawlers, preview fetchers, headless browsers and scripts", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(
      isBot("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36"),
    ).toBe(true);
    expect(isBot("Mozilla/5.0 (Linux; Android 11) Chrome/141.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse")).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
  });

  it("treats a missing user agent as a bot", () => {
    expect(isBot(undefined)).toBe(true);
    expect(isBot("")).toBe(true);
  });
});

describe("countryFromHeader", () => {
  it("normalises a two-letter code", () => {
    expect(countryFromHeader("BD")).toBe("BD");
    expect(countryFromHeader(" bd ")).toBe("BD");
  });

  it("drops unknown, Tor and malformed values", () => {
    expect(countryFromHeader("XX")).toBeNull();
    expect(countryFromHeader("T1")).toBeNull();
    expect(countryFromHeader("BGD")).toBeNull();
    expect(countryFromHeader("")).toBeNull();
    expect(countryFromHeader(undefined)).toBeNull();
  });
});
```

`features/web-analytics/lib/buckets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bucketUnit } from "./buckets";

const day = 24 * 60 * 60 * 1000;
const start = new Date("2026-10-01T00:00:00+06:00");
const after = (ms: number) => new Date(start.getTime() + ms);

describe("bucketUnit", () => {
  it("uses hours for a day or two", () => {
    expect(bucketUnit(start, after(day - 1))).toBe("hour");
    expect(bucketUnit(start, after(2 * day))).toBe("hour");
  });

  it("uses days up to 92 days", () => {
    expect(bucketUnit(start, after(7 * day - 1))).toBe("day");
    expect(bucketUnit(start, after(90 * day - 1))).toBe("day");
    expect(bucketUnit(start, after(92 * day))).toBe("day");
  });

  it("uses months beyond that", () => {
    expect(bucketUnit(start, after(120 * day))).toBe("month");
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run features/web-analytics/lib`
Expected: FAIL. The suites cannot resolve `./route-pattern`, `./request-info` and `./buckets`.

- [ ] **Step 3: Implement**

`features/web-analytics/lib/route-pattern.ts`:

```ts
// The storefront's dynamic routes (app/(client)/**/[param]). A path under one
// of these prefixes with exactly one more segment collapses to the pattern, so
// every product page counts as one "/shop/[slug]" row in the Routes panel.
const PATTERNS: ReadonlyArray<{ prefix: string; pattern: string }> = [
  { prefix: "/shop/", pattern: "/shop/[slug]" },
  { prefix: "/blog/", pattern: "/blog/[slug]" },
  { prefix: "/categories/", pattern: "/categories/[value]" },
  { prefix: "/videos/share/", pattern: "/videos/share/[slug]" },
  { prefix: "/orders/", pattern: "/orders/[orderId]" },
];

export function toRoute(path: string): string {
  const clean = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  for (const { prefix, pattern } of PATTERNS) {
    if (!clean.startsWith(prefix)) continue;
    const rest = clean.slice(prefix.length);
    if (rest && !rest.includes("/")) return pattern;
  }
  return clean;
}
```

`features/web-analytics/lib/request-info.ts`:

```ts
// Crawlers, link-preview fetchers, monitoring probes and headless automation.
// In-app browsers (Facebook, Instagram, YouTube) are real visitors and must not
// match: their user agents carry FBAN/FBAV/Instagram tokens, none of these.
const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|preview|monitor|curl|wget|python|axios|node-fetch|go-http|java\/|phantomjs|selenium|puppeteer|playwright/i;

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

/** Cloudflare's cf-ipcountry as ISO alpha-2, or null for unknown (XX) / Tor (T1). */
export function countryFromHeader(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;
  return code;
}
```

`features/web-analytics/lib/buckets.ts`:

```ts
export type BucketUnit = "hour" | "day" | "month";

/** The store's clock: chart buckets and "today" are Dhaka days, not UTC days. */
export const ANALYTICS_TZ = "Asia/Dhaka";

const DAY_MS = 24 * 60 * 60 * 1000;

export function bucketUnit(start: Date, end: Date): BucketUnit {
  const days = (end.getTime() - start.getTime()) / DAY_MS;
  if (days <= 2) return "hour";
  if (days <= 92) return "day";
  return "month";
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm vitest run features/web-analytics/lib`
Expected: PASS (3 files).

- [ ] **Step 5: Commit**

```bash
git add features/web-analytics/lib/route-pattern.ts features/web-analytics/lib/request-info.ts features/web-analytics/lib/buckets.ts features/web-analytics/lib/*.test.ts
git commit -m "feat(web-analytics): route patterns, bot and country detection, bucket units"
```

---

### Task 2: Session and landing rules

**Files:**
- Create: `features/web-analytics/lib/session.ts`
- Test: `features/web-analytics/lib/session.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SESSION_IDLE_MS = 1_800_000`
  - `type AdClick = "google" | "facebook"`
  - `interface Landing { referrerHost; utmSource; utmMedium; utmCampaign; utmTerm; utmContent: string | null; adClick: AdClick | null }`
  - `interface StoredSession { id: string; lastSeen: number; landing: Landing }`
  - `EMPTY_LANDING: Landing`
  - `referrerHostOf(referrer: string, ownHost: string): string | null`
  - `parseLanding(href: string, referrer: string): Landing`
  - `resolveSession(prev: StoredSession | null, now: number, href: string, referrer: string, newId: () => string): StoredSession`
  - `loadSession(storage: Pick<Storage, "getItem"> | null, key: string): StoredSession | null`
  - `saveSession(storage: Pick<Storage, "setItem"> | null, key: string, session: StoredSession): void`

- [ ] **Step 1: Write the failing test**

`features/web-analytics/lib/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  EMPTY_LANDING,
  SESSION_IDLE_MS,
  loadSession,
  parseLanding,
  referrerHostOf,
  resolveSession,
  saveSession,
  type StoredSession,
} from "./session";

const HOME = "https://sleepsheetbd.com/";
const ids = (...values: string[]) => {
  let i = 0;
  return () => values[i++] ?? "extra";
};

describe("referrerHostOf", () => {
  it("returns the external host without www.", () => {
    expect(referrerHostOf("https://www.youtube.com/watch?v=1", "sleepsheetbd.com")).toBe("youtube.com");
    expect(referrerHostOf("https://m.facebook.com/", "sleepsheetbd.com")).toBe("m.facebook.com");
  });

  it("treats the store's own host as no referrer, whatever the www. or case", () => {
    expect(referrerHostOf("https://www.sleepsheetbd.com/shop", "sleepsheetbd.com")).toBeNull();
    expect(referrerHostOf("https://SLEEPSHEETBD.COM/", "www.sleepsheetbd.com")).toBeNull();
    expect(referrerHostOf("https://sleepsheetbd.com/", "sleepsheetbd.com")).toBeNull();
  });

  it("returns null for an empty or broken referrer", () => {
    expect(referrerHostOf("", "sleepsheetbd.com")).toBeNull();
    expect(referrerHostOf("not a url", "sleepsheetbd.com")).toBeNull();
  });
});

describe("parseLanding", () => {
  it("reads UTM tags and the ad click id", () => {
    const landing = parseLanding(
      "https://sleepsheetbd.com/shop/a?utm_source=youtube&utm_medium=cpc&utm_campaign=oct&gclid=abc",
      "https://www.youtube.com/",
    );
    expect(landing).toEqual({
      referrerHost: "youtube.com",
      utmSource: "youtube",
      utmMedium: "cpc",
      utmCampaign: "oct",
      utmTerm: null,
      utmContent: null,
      adClick: "google",
    });
    expect(parseLanding(`${HOME}?fbclid=x`, "").adClick).toBe("facebook");
  });

  it("caps long tag values at 150 characters", () => {
    expect(parseLanding(`${HOME}?utm_campaign=${"x".repeat(400)}`, "").utmCampaign).toHaveLength(150);
  });

  it("returns an empty landing for an unparsable URL", () => {
    expect(parseLanding("::", "")).toEqual(EMPTY_LANDING);
  });
});

describe("resolveSession", () => {
  const start = 1_000_000;

  it("starts a session when there is none", () => {
    const s = resolveSession(null, start, HOME, "https://www.youtube.com/", ids("a"));
    expect(s).toEqual({ id: "a", lastSeen: start, landing: { ...EMPTY_LANDING, referrerHost: "youtube.com" } });
  });

  it("continues within the idle window and keeps the landing", () => {
    const first = resolveSession(null, start, HOME, "https://www.youtube.com/", ids("a"));
    const next = resolveSession(first, start + SESSION_IDLE_MS - 1, `${HOME}shop`, "https://sleepsheetbd.com/", ids("b"));
    expect(next.id).toBe("a");
    expect(next.lastSeen).toBe(start + SESSION_IDLE_MS - 1);
    expect(next.landing.referrerHost).toBe("youtube.com");
  });

  it("starts a new session after 30 idle minutes", () => {
    const first = resolveSession(null, start, HOME, "", ids("a"));
    expect(resolveSession(first, start + SESSION_IDLE_MS + 1, HOME, "", ids("b")).id).toBe("b");
  });

  it("keeps the session for more events on the same campaign landing URL", () => {
    const url = `${HOME}shop/a?utm_source=youtube&utm_campaign=oct`;
    const first = resolveSession(null, start, url, "", ids("a"));
    expect(resolveSession(first, start + 1000, url, "", ids("b")).id).toBe("a");
  });

  it("starts a new session for a different campaign click", () => {
    const first = resolveSession(null, start, `${HOME}?utm_campaign=oct`, "", ids("a"));
    const next = resolveSession(first, start + 1000, `${HOME}?utm_campaign=nov`, "", ids("b"));
    expect(next.id).toBe("b");
    expect(next.landing.utmCampaign).toBe("nov");
  });
});

describe("loadSession / saveSession", () => {
  const session: StoredSession = { id: "a", lastSeen: 5, landing: { ...EMPTY_LANDING, utmSource: "yt" } };
  const throwing = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };

  it("round-trips through storage", () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    saveSession(storage, "ss_session", session);
    expect(loadSession(storage, "ss_session")).toEqual(session);
  });

  it("returns null for missing, broken or wrongly shaped values", () => {
    expect(loadSession(null, "k")).toBeNull();
    expect(loadSession({ getItem: () => "{not json" }, "k")).toBeNull();
    expect(loadSession({ getItem: () => JSON.stringify({ id: 1 }) }, "k")).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    expect(loadSession(throwing, "k")).toBeNull();
    expect(() => saveSession(throwing, "k", session)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm vitest run features/web-analytics/lib/session.test.ts`
Expected: FAIL. The suite cannot resolve `./session`.

- [ ] **Step 3: Implement**

`features/web-analytics/lib/session.ts`:

```ts
// Session rules for first-party analytics. Pure functions: the collector
// (collector.ts) supplies the clock, the URL, the referrer and storage.

export const SESSION_IDLE_MS = 30 * 60 * 1000;

const MAX_PARAM = 150;
const MAX_HOST = 100;
const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

export type AdClick = "google" | "facebook";

export interface Landing {
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  adClick: AdClick | null;
}

export interface StoredSession {
  id: string;
  lastSeen: number;
  landing: Landing;
}

export const EMPTY_LANDING: Landing = {
  referrerHost: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  adClick: null,
};

const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");

/** The external referrer's host without "www.", or null for none or our own site. */
export function referrerHostOf(referrer: string, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = bare(new URL(referrer).hostname);
    if (!host || host === bare(ownHost)) return null;
    return host.slice(0, MAX_HOST);
  } catch {
    return null;
  }
}

function param(url: URL, key: string): string | null {
  const value = url.searchParams.get(key)?.trim();
  return value ? value.slice(0, MAX_PARAM) : null;
}

export function parseLanding(href: string, referrer: string): Landing {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return EMPTY_LANDING;
  }
  return {
    referrerHost: referrerHostOf(referrer, url.hostname),
    utmSource: param(url, "utm_source"),
    utmMedium: param(url, "utm_medium"),
    utmCampaign: param(url, "utm_campaign"),
    utmTerm: param(url, "utm_term"),
    utmContent: param(url, "utm_content"),
    adClick: url.searchParams.has("gclid") ? "google" : url.searchParams.has("fbclid") ? "facebook" : null,
  };
}

function hasCampaign(href: string): boolean {
  try {
    const url = new URL(href);
    return CAMPAIGN_KEYS.some((key) => url.searchParams.has(key));
  } catch {
    return false;
  }
}

function sameCampaign(a: Landing, b: Landing): boolean {
  return (
    a.utmSource === b.utmSource &&
    a.utmMedium === b.utmMedium &&
    a.utmCampaign === b.utmCampaign &&
    a.utmTerm === b.utmTerm &&
    a.utmContent === b.utmContent &&
    a.adClick === b.adClick
  );
}

/**
 * The session this event belongs to. A new one starts when there is no
 * previous session, after SESSION_IDLE_MS without events, or when the URL
 * carries a different campaign than the session landed with (a new ad click).
 * Otherwise the session continues and only its lastSeen moves forward.
 */
export function resolveSession(
  prev: StoredSession | null,
  now: number,
  href: string,
  referrer: string,
  newId: () => string,
): StoredSession {
  const fresh = (): StoredSession => ({ id: newId(), lastSeen: now, landing: parseLanding(href, referrer) });
  if (!prev || now - prev.lastSeen > SESSION_IDLE_MS) return fresh();
  if (hasCampaign(href) && !sameCampaign(parseLanding(href, referrer), prev.landing)) return fresh();
  return { ...prev, lastSeen: now };
}

export function loadSession(storage: Pick<Storage, "getItem"> | null, key: string): StoredSession | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredSession> | null;
    if (
      typeof value?.id !== "string" ||
      typeof value.lastSeen !== "number" ||
      typeof value.landing !== "object" ||
      value.landing === null
    ) {
      return null;
    }
    return { id: value.id, lastSeen: value.lastSeen, landing: { ...EMPTY_LANDING, ...value.landing } };
  } catch {
    return null;
  }
}

export function saveSession(storage: Pick<Storage, "setItem"> | null, key: string, session: StoredSession): void {
  try {
    storage?.setItem(key, JSON.stringify(session));
  } catch {
    // Storage blocked or full: the collector keeps the session in memory.
  }
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run features/web-analytics/lib/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/web-analytics/lib/session.ts features/web-analytics/lib/session.test.ts
git commit -m "feat(web-analytics): session and landing attribution rules"
```

---

### Task 3: `analytics_events` table and migration

**Files:**
- Modify: `db/schema.ts` (imports at the top; new table after `activityLogs`, around line 897)
- Create: `db/migrations/0031_<drizzle-generated-name>.sql` (plus the snapshot and journal entry `pnpm db:generate` writes)

**Interfaces:**
- Consumes: nothing.
- Produces: the Drizzle table `analyticsEvents` exported from `db/schema.ts`. Column names in SQL: `id, ts, type, visitor_id, session_id, path, route, hostname, referrer_host, utm_source, utm_medium, utm_campaign, utm_term, utm_content, ad_click, country, device, browser, os, label, product_id, value, order_id`.

- [ ] **Step 1: Make sure the local database is the target**

```bash
docker compose -f docker-compose.db.yml up -d
set -a && source .env && set +a && node -e 'const u=new URL(process.env.DATABASE_URL);console.log(u.hostname+":"+u.port)'
```

Expected: `localhost:5433` or `127.0.0.1:5433`. **If it prints anything else, stop.** `.env` is then pointing at a remote database. Ask the owner before continuing.

- [ ] **Step 2: Add the table to the schema**

In `db/schema.ts`, add `bigint` to the `drizzle-orm/pg-core` import list:

```ts
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  doublePrecision,
```

Then add this table directly after the `activityLogs` table definition (after its closing `]);`):

```ts
// First-party web analytics (features/web-analytics). One row per storefront
// page view or shopping event, plus a server-written row per website order.
// The session's landing attributes (referrer, UTM, ad click) are repeated on
// every row so dashboard filters never need a join. Kept 12 months
// (lib/data-retention.ts). No IP address is stored.
export const analyticsEvents = pgTable("analytics_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  ts: timestamp("ts", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
  type: text("type").notNull(),
  visitorId: text("visitor_id").notNull(),
  sessionId: text("session_id").notNull(),
  path: text("path").notNull(),
  route: text("route").notNull(),
  hostname: text("hostname"),
  referrerHost: text("referrer_host"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  adClick: text("ad_click"),
  country: text("country"),
  device: text("device"),
  browser: text("browser"),
  os: text("os"),
  label: text("label"),
  productId: text("product_id"),
  value: money("value"),
  orderId: text("order_id"),
}, (table) => [
  index("analytics_events_ts_idx").on(table.ts),
  index("analytics_events_type_ts_idx").on(table.type, table.ts),
  index("analytics_events_session_id_idx").on(table.sessionId),
  index("analytics_events_order_id_idx").on(table.orderId).where(sql`${table.orderId} IS NOT NULL`),
]);
```

(`money` and `sql` are already defined and imported in this file.)

- [ ] **Step 3: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `db/migrations/0031_<name>.sql`, an updated `db/migrations/meta/_journal.json` and a new snapshot.

- [ ] **Step 4: Check and harden the SQL**

Open the new `0031_*.sql`. It must contain **only** the `CREATE TABLE "analytics_events"` statement and its four `CREATE INDEX` statements. If it contains anything else, the snapshot chain is out of sync (see `db/migrations/README.md`). Those other statements are already live, so delete them.

Then make every statement idempotent. The file should end up as:

```sql
CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analytics_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"ts" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"path" text NOT NULL,
	"route" text NOT NULL,
	"hostname" text,
	"referrer_host" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"ad_click" text,
	"country" text,
	"device" text,
	"browser" text,
	"os" text,
	"label" text,
	"product_id" text,
	"value" numeric(12, 2),
	"order_id" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_ts_idx" ON "analytics_events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_type_ts_idx" ON "analytics_events" USING btree ("type","ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_session_id_idx" ON "analytics_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_order_id_idx" ON "analytics_events" USING btree ("order_id") WHERE "analytics_events"."order_id" IS NOT NULL;
```

Keep drizzle's exact column formatting where it differs cosmetically. What matters is the `IF NOT EXISTS` and that nothing else is in the file.

- [ ] **Step 5: Check the precondition, then apply locally**

```bash
set -a && source .env && set +a
psql "$DATABASE_URL" -tAc "select to_regclass('public.analytics_events')"
```

Expected: an empty line, meaning the table doesn't exist yet. Then apply:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0031_*.sql
psql "$DATABASE_URL" -c '\d analytics_events'
```

Expected: the table with 23 columns and the 4 indexes listed.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add db/schema.ts db/migrations/
git commit -m "feat(web-analytics): analytics_events table (migration 0031)"
```

---

### Task 4: Ingestion route `POST /api/t`, retention, the settings key

**Files:**
- Create: `features/web-analytics/lib/types.ts`
- Create: `features/web-analytics/server/payload.ts`
- Create: `features/web-analytics/server/store.ts`
- Create: `features/web-analytics/server/collect.ts`
- Modify: `lib/data-retention.ts`
- Modify: `features/settings/server/route.ts` (PATCH zod schema, next to `gtm_server_url`)
- Modify: `features/settings/api/use-settings.ts` (`useUpdateSettings` data type)
- Modify: `app/api/[[...route]]/route.ts` (import + `.route("/t", …)`)
- Test: `features/web-analytics/server/payload.test.ts`, `features/web-analytics/server/collect.test.ts`

**Interfaces:**
- Consumes: `toRoute` (Task 1), `isBot`, `countryFromHeader` (Task 1), `analyticsEvents` (Task 3), `parseUserAgent` from `@/lib/user-agent-parser`, `rateLimit` from `@/lib/rate-limit`, `getSetting` from `@/lib/settings-cache`.
- Produces:
  - `COLLECT_TYPES`, `type CollectType`, `type AnalyticsEventType`, `interface CollectPayload` (`lib/types.ts`)
  - `MAX_BODY_BYTES`, `collectPayloadSchema`, `parseCollectBody(raw: string): CollectPayload | null` (`server/payload.ts`)
  - `type AnalyticsEvent`, `type NewAnalyticsEvent`, `insertEvent(row): Promise<void>`, `isAnalyticsEnabled(): Promise<boolean>`, `findLastSessionEvent(sessionId): Promise<AnalyticsEvent | null>` (`server/store.ts`)
  - `interface CollectDeps`, `createCollectRoute(deps)`, default export (`server/collect.ts`)
  - `sweepRetention("analytics")` (`lib/data-retention.ts`)

- [ ] **Step 1: Shared types**

`features/web-analytics/lib/types.ts`:

```ts
// Shared by the storefront collector, the ingestion route and the dashboard.
// No runtime dependencies, so it is safe in every bundle.

/** Events the browser sends. order_complete is written by the server only. */
export const COLLECT_TYPES = ["page_view", "product_view", "add_to_cart", "buy_now", "checkout_start"] as const;
export type CollectType = (typeof COLLECT_TYPES)[number];
export type AnalyticsEventType = CollectType | "order_complete";

export interface CollectPayload {
  type: CollectType;
  path: string;
  hostname: string | null;
  visitorId: string;
  sessionId: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  adClick: "google" | "facebook" | null;
  label: string | null;
  productId: string | null;
  value: number | null;
}
```

- [ ] **Step 2: Write the failing payload test**

`features/web-analytics/server/payload.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, parseCollectBody } from "./payload";

const valid = {
  type: "page_view",
  path: "/shop/premium-comforter",
  hostname: "sleepsheetbd.com",
  visitorId: "v1",
  sessionId: "s1",
  referrerHost: "youtube.com",
  utmSource: "youtube",
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  adClick: null,
  label: null,
  productId: null,
  value: null,
};

describe("parseCollectBody", () => {
  it("accepts a well-formed payload", () => {
    expect(parseCollectBody(JSON.stringify(valid))).toEqual(valid);
  });

  it("fills omitted optional fields with null", () => {
    const parsed = parseCollectBody(JSON.stringify({ type: "page_view", path: "/", visitorId: "v", sessionId: "s" }));
    expect(parsed).toMatchObject({ hostname: null, referrerHost: null, adClick: null, value: null });
  });

  it("turns blank strings into null", () => {
    expect(parseCollectBody(JSON.stringify({ ...valid, utmSource: "  " }))?.utmSource).toBeNull();
  });

  it("rejects malformed and hostile bodies", () => {
    expect(parseCollectBody("not json")).toBeNull();
    expect(parseCollectBody("null")).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, type: "order_complete" }))).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, type: "drop_table" }))).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, path: "shop" }))).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, value: -5 }))).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, visitorId: "" }))).toBeNull();
    expect(parseCollectBody(JSON.stringify({ ...valid, label: "x".repeat(301) }))).toBeNull();
  });

  it("rejects bodies over the size cap", () => {
    expect(parseCollectBody(JSON.stringify({ ...valid, label: "x" }).padEnd(MAX_BODY_BYTES + 1, " "))).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm vitest run features/web-analytics/server/payload.test.ts`
Expected: FAIL. The suite cannot resolve `./payload`.

- [ ] **Step 4: Implement the payload parser**

`features/web-analytics/server/payload.ts`:

```ts
import { z } from "zod";
import { COLLECT_TYPES, type CollectPayload } from "../lib/types";

export const MAX_BODY_BYTES = 2048;

// Optional text: trimmed, length-capped, blank or missing becomes null.
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

const id = z.string().trim().min(1).max(64);

export const collectPayloadSchema = z.object({
  type: z.enum(COLLECT_TYPES),
  path: z.string().trim().min(1).max(300).startsWith("/"),
  hostname: text(100),
  visitorId: id,
  sessionId: id,
  referrerHost: text(100),
  utmSource: text(150),
  utmMedium: text(150),
  utmCampaign: text(150),
  utmTerm: text(150),
  utmContent: text(150),
  adClick: z
    .enum(["google", "facebook"])
    .nullish()
    .transform((value) => value ?? null),
  label: text(300),
  productId: text(64),
  value: z
    .number()
    .finite()
    .min(0)
    .max(100_000_000)
    .nullish()
    .transform((value) => value ?? null),
});

/** The beacon body as a validated payload, or null for anything else. */
export function parseCollectBody(raw: string): CollectPayload | null {
  if (raw.length > MAX_BODY_BYTES) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = collectPayloadSchema.safeParse(json);
  return result.success ? result.data : null;
}
```

- [ ] **Step 5: Run the payload test to see it pass**

Run: `pnpm vitest run features/web-analytics/server/payload.test.ts`
Expected: PASS.

- [ ] **Step 6: Database access and retention**

`features/web-analytics/server/store.ts`:

```ts
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { getSetting } from "@/lib/settings-cache";

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export async function insertEvent(row: NewAnalyticsEvent): Promise<void> {
  await db.insert(analyticsEvents).values(row);
}

/** On unless an admin switched it off (settings key analytics_enabled = "false"). */
export async function isAnalyticsEnabled(): Promise<boolean> {
  return (await getSetting("analytics_enabled")) !== "false";
}

/** The session's most recent event, which order attribution copies from. */
export async function findLastSessionEvent(sessionId: string): Promise<AnalyticsEvent | null> {
  const [row] = await db
    .select()
    .from(analyticsEvents)
    .where(eq(analyticsEvents.sessionId, sessionId))
    .orderBy(desc(analyticsEvents.ts))
    .limit(1);
  return row ?? null;
}
```

In `lib/data-retention.ts`:

1. Change the schema import to `import { activityLogs, analyticsEvents } from "@/db/schema";`.
2. Add these after `ACTIVITY_RETENTION_DAYS`:

```ts
export const ANALYTICS_RETENTION_DAYS = 365;
```

```ts
/** Delete web analytics events older than the retention window. */
export async function purgeOldAnalyticsEvents(): Promise<void> {
  await db.delete(analyticsEvents).where(lt(analyticsEvents.ts, cutoff(ANALYTICS_RETENTION_DAYS)));
}
```

3. Replace `sweepRetention` with:

```ts
export function sweepRetention(kind: "activity" | "analytics"): void {
  if (!due(kind)) return;
  const purge = kind === "activity" ? purgeOldActivityLogs : purgeOldAnalyticsEvents;
  void purge().catch((err) => console.error(`Retention sweep (${kind}) failed:`, err));
}
```

- [ ] **Step 7: Write the failing route test**

`features/web-analytics/server/collect.test.ts`:

```ts
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
```

- [ ] **Step 8: Run it to see it fail**

Run: `pnpm vitest run features/web-analytics/server/collect.test.ts`
Expected: FAIL. The suite cannot resolve `./collect`.

- [ ] **Step 9: Implement the route**

`features/web-analytics/server/collect.ts`:

```ts
import { Hono } from "hono";
import { rateLimit } from "@/lib/rate-limit";
import { parseUserAgent } from "@/lib/user-agent-parser";
import { sweepRetention } from "@/lib/data-retention";
import { countryFromHeader, isBot } from "../lib/request-info";
import { toRoute } from "../lib/route-pattern";
import { MAX_BODY_BYTES, parseCollectBody } from "./payload";
import { insertEvent, isAnalyticsEnabled, type NewAnalyticsEvent } from "./store";

export interface CollectDeps {
  insert: (row: NewAnalyticsEvent) => Promise<void>;
  isEnabled: () => Promise<boolean>;
  afterInsert: () => void;
}

// A beacon from our own pages carries an Origin (or, in a few browsers, only
// a Referer) on the same host the request was sent to. Comparing against the
// request's own host works on the dev port and in production alike.
function isSameOrigin(source: string | undefined, host: string): boolean {
  if (!source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

/**
 * POST /api/t: the storefront's analytics beacon. Public (no session), so it
 * validates everything and answers 204 whatever happens. Beacons ignore the
 * response, and a failure here must never surface on the page.
 */
export function createCollectRoute(deps: CollectDeps) {
  return new Hono().post("/", rateLimit("collect", 120, 60_000), async (c) => {
    const done = () => c.body(null, 204);
    try {
      const host =
        c.req.header("x-forwarded-host")?.split(",")[0]?.trim() || c.req.header("host") || new URL(c.req.url).host;
      if (!isSameOrigin(c.req.header("origin") || c.req.header("referer"), host)) return done();
      if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) return done();

      const payload = parseCollectBody(await c.req.text());
      if (!payload || payload.path.startsWith("/dashboard")) return done();

      const userAgent = c.req.header("user-agent");
      if (isBot(userAgent)) return done();
      if (!(await deps.isEnabled())) return done();

      const { browser, os, device } = parseUserAgent(userAgent);
      await deps.insert({
        type: payload.type,
        visitorId: payload.visitorId,
        sessionId: payload.sessionId,
        path: payload.path,
        route: toRoute(payload.path),
        hostname: payload.hostname,
        referrerHost: payload.referrerHost,
        utmSource: payload.utmSource,
        utmMedium: payload.utmMedium,
        utmCampaign: payload.utmCampaign,
        utmTerm: payload.utmTerm,
        utmContent: payload.utmContent,
        adClick: payload.adClick,
        country: countryFromHeader(c.req.header("cf-ipcountry")),
        device,
        browser,
        os,
        label: payload.label,
        productId: payload.productId,
        value: payload.value,
      });
      deps.afterInsert();
    } catch (err) {
      console.error("Analytics collect failed:", err);
    }
    return done();
  });
}

export default createCollectRoute({
  insert: insertEvent,
  isEnabled: isAnalyticsEnabled,
  afterInsert: () => sweepRetention("analytics"),
});
```

- [ ] **Step 10: Run the route test to see it pass**

Run: `pnpm vitest run features/web-analytics/server`
Expected: PASS (payload + collect).

- [ ] **Step 11: Settings key and route mount**

In `features/settings/server/route.ts`, inside the PATCH `z.object({ … })`, add after `gtm_server_url: z.string().optional(),`:

```ts
        // First-party web analytics on/off (features/web-analytics). Missing
        // means on; only "false" stops /api/t and order attribution.
        analytics_enabled: z.enum(["true", "false"]).optional(),
```

In `features/settings/api/use-settings.ts`, in the `useUpdateSettings` `mutationFn` data type, add after `footer_copyright?: string;`:

```ts
      analytics_enabled?: "true" | "false";
```

In `app/api/[[...route]]/route.ts`:

- Add `import webAnalyticsCollect from "@/features/web-analytics/server/collect";` after the `audiences` import.
- Add `.route("/t", webAnalyticsCollect)` after `.route("/audiences",audiences)`.

`logActivity` needs no change. `record()` in `features/activity/server/log-activity.ts` returns early when there is no session user, and `/api/t` has no `sessionMiddleware`.

- [ ] **Step 12: Smoke test against the dev server**

Start the dev server if it isn't running (`pnpm dev`) and use its port (this repo's server has been running on `:3001`). Then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/t \
  -H 'origin: http://localhost:3001' -H 'content-type: application/json' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' \
  -d '{"type":"page_view","path":"/curl-check","hostname":"localhost","visitorId":"curl-v","sessionId":"curl-s"}'
set -a && source .env && set +a
psql "$DATABASE_URL" -c "select type, path, route, browser, os, device from analytics_events where visitor_id = 'curl-v'"
psql "$DATABASE_URL" -c "delete from analytics_events where visitor_id = 'curl-v'"
```

Expected: `204`, one row (`page_view | /curl-check | /curl-check | Chrome 141 | macOS | Desktop`), then `DELETE 1`.

- [ ] **Step 13: Type-check and commit**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

```bash
git add features/web-analytics lib/data-retention.ts features/settings "app/api/[[...route]]/route.ts"
git commit -m "feat(web-analytics): POST /api/t ingestion, retention and on/off setting"
```

---

### Task 5: Browser collector and its wiring

**Files:**
- Create: `features/web-analytics/lib/collector.ts`
- Modify: `lib/traffic-tracker.ts`
- Modify: `components/traffic-tracker.tsx`
- Modify: `app/(client)/checkout/checkout-client.tsx`
- Test: `features/web-analytics/lib/collector.test.ts`, `lib/traffic-tracker.test.ts`

**Interfaces:**
- Consumes: `loadSession`, `saveSession`, `resolveSession`, `StoredSession` (Task 2); `CollectPayload`, `CollectType`, `COLLECT_TYPES` (Task 4); `getVisitorId` from `@/lib/visitor-id`; `useSettings` from `@/features/settings/api/use-settings`.
- Produces:
  - `setCollectorEnabled(value: boolean): void`
  - `interface CollectExtra { label?: string | null; productId?: string | null; value?: number | null }`
  - `buildPayload(type: CollectType, path: string, session: StoredSession, visitorId: string, hostname: string, extra?: CollectExtra): CollectPayload`
  - `collect(type: CollectType, path: string, extra?: CollectExtra): void`
  - `getAnalyticsIds(): { visitorId: string; sessionId: string } | null`
  - `toCollectExtra(label?: string, meta?: Record<string, string | number | boolean>): CollectExtra` (exported from `lib/traffic-tracker.ts`)

- [ ] **Step 1: Write the failing tests**

`features/web-analytics/lib/collector.test.ts`:

```ts
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
```

`lib/traffic-tracker.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toCollectExtra } from "./traffic-tracker";

describe("toCollectExtra", () => {
  it("uses price × quantity as the value", () => {
    expect(toCollectExtra("Comforter", { productId: "p1", price: 2450, quantity: 2 })).toEqual({
      label: "Comforter",
      productId: "p1",
      value: 4900,
    });
  });

  it("defaults the quantity to one and tolerates missing meta", () => {
    expect(toCollectExtra("Comforter", { productId: "p1", price: 2450 }).value).toBe(2450);
    expect(toCollectExtra(undefined, undefined)).toEqual({ label: null, productId: null, value: null });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run features/web-analytics/lib/collector.test.ts lib/traffic-tracker.test.ts`
Expected: FAIL. `./collector` does not resolve, and `toCollectExtra` is not exported.

- [ ] **Step 3: Implement the collector**

`features/web-analytics/lib/collector.ts`:

```ts
"use client";

import { getVisitorId } from "@/lib/visitor-id";
import { loadSession, resolveSession, saveSession, type StoredSession } from "./session";
import type { CollectPayload, CollectType } from "./types";

const ENDPOINT = "/api/t";
const SESSION_KEY = "ss_session";

// Sends by default so the landing page view isn't lost while settings load;
// TrafficTracker turns it off once settings say analytics_enabled = "false".
// The server is the real gate and drops anything that arrives while off.
let enabled = true;
// Fallback when localStorage is blocked: one session per page lifetime.
let memorySession: StoredSession | null = null;

export function setCollectorEnabled(value: boolean): void {
  enabled = value;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function currentSession(now: number): StoredSession {
  const store = storage();
  const prev = loadSession(store, SESSION_KEY) ?? memorySession;
  const next = resolveSession(prev, now, window.location.href, document.referrer, newId);
  memorySession = next;
  saveSession(store, SESSION_KEY, next);
  return next;
}

export interface CollectExtra {
  label?: string | null;
  productId?: string | null;
  value?: number | null;
}

export function buildPayload(
  type: CollectType,
  path: string,
  session: StoredSession,
  visitorId: string,
  hostname: string,
  extra: CollectExtra = {},
): CollectPayload {
  const value = extra.value;
  return {
    type,
    path: path.split(/[?#]/)[0].slice(0, 300) || "/",
    hostname: hostname.slice(0, 100) || null,
    visitorId,
    sessionId: session.id,
    ...session.landing,
    label: extra.label ? extra.label.slice(0, 300) : null,
    productId: extra.productId ? extra.productId.slice(0, 64) : null,
    value: typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null,
  };
}

/** Fire-and-forget beacon to /api/t. Never throws. */
export function collect(type: CollectType, path: string, extra?: CollectExtra): void {
  try {
    if (!enabled || typeof window === "undefined") return;
    if (path.startsWith("/dashboard") || window.location.pathname.startsWith("/dashboard")) return;
    const body = JSON.stringify(
      buildPayload(type, path, currentSession(Date.now()), getVisitorId(), window.location.hostname, extra),
    );
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "application/json" },
    }).catch(() => {});
  } catch {
    // Analytics must never break the page.
  }
}

/** The ids the checkout request carries so the server can attribute the order. */
export function getAnalyticsIds(): { visitorId: string; sessionId: string } | null {
  try {
    const session = loadSession(storage(), SESSION_KEY) ?? memorySession;
    return session ? { visitorId: getVisitorId(), sessionId: session.id } : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Route `trackEvent` through the collector**

Replace the whole of `lib/traffic-tracker.ts` with:

```ts
"use client";

import { afterNextPaint } from "@/lib/after-next-paint";
import { collect, type CollectExtra } from "@/features/web-analytics/lib/collector";
import { COLLECT_TYPES, type CollectType } from "@/features/web-analytics/lib/types";

export type TrafficEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "buy_now"
  | "search"
  | "wishlist_add"
  | "checkout_start"
  | "order_complete";

// Every event goes to Google Analytics (gtag). Page views and the shopping
// events in COLLECT_TYPES also go to the store's own analytics
// (features/web-analytics), stored in the self-hosted Postgres. That used to
// be impossible on serverless Neon, where a write per page view kept the
// compute awake around the clock (the old traffic_events table, dropped in
// migration 0013). order_complete is recorded by the checkout route instead.
const isCollectType = (type: TrafficEventType): type is CollectType =>
  (COLLECT_TYPES as readonly string[]).includes(type);

export function toCollectExtra(
  label?: string,
  meta?: Record<string, string | number | boolean>,
): CollectExtra {
  const price = typeof meta?.price === "number" ? meta.price : undefined;
  const quantity = typeof meta?.quantity === "number" ? meta.quantity : 1;
  return {
    label: label ?? null,
    productId: typeof meta?.productId === "string" ? meta.productId : null,
    value: price === undefined ? null : price * quantity,
  };
}

export function trackEvent(
  type: TrafficEventType,
  path: string,
  label?: string,
  meta?: Record<string, string | number | boolean>
) {
  try {
    if (typeof window === "undefined") return;
    if (path.startsWith("/dashboard") || window.location?.pathname?.startsWith("/dashboard")) return;

    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    const firstParty = isCollectType(type);
    if (!firstParty && typeof gtag !== "function") return;

    // After the next paint, in order with lib/gtm's pushes: gtag() is a
    // dataLayer push too, so calling it inside a click handler ran GTM's
    // tags inside that tap. The beacon waits for the same reason.
    afterNextPaint(() => {
      if (firstParty) collect(type, path, toCollectExtra(label, meta));
      if (typeof gtag === "function") {
        gtag("event", type, {
          page_path: path,
          event_label: label,
          ...meta,
        });
      }
    });
  } catch {}
}
```

- [ ] **Step 5: Follow the admin's on/off switch**

Replace `components/traffic-tracker.tsx` with:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/traffic-tracker";
import { useSettings } from "@/features/settings/api/use-settings";
import { setCollectorEnabled } from "@/features/web-analytics/lib/collector";

export function TrafficTracker() {
  const pathname = usePathname();
  const { data: settings } = useSettings();
  const analyticsSetting = settings?.analytics_enabled;
  // Last path actually reported. Starts empty so the first render reports the
  // landing page, and a single ref covers both the initial view and later
  // navigations — the old two-effect version double-fired the first page view
  // under React Strict Mode's dev double-invoke.
  const reportedPath = useRef<string | null>(null);

  useEffect(() => {
    setCollectorEnabled(analyticsSetting !== "false");
  }, [analyticsSetting]);

  useEffect(() => {
    if (reportedPath.current === pathname) return;
    reportedPath.current = pathname;
    trackEvent("page_view", pathname);
  }, [pathname]);

  return null;
}
```

- [ ] **Step 6: Record `checkout_start`**

In `app/(client)/checkout/checkout-client.tsx`, add the import:

```ts
import { collect } from "@/features/web-analytics/lib/collector";
```

and inside the existing `const track = () => { … }` function, after the `trackGtmBeginCheckout({ … });` call, add:

```ts
      // First-party funnel step. Sent straight to the collector, not through
      // trackEvent, so GA4 gets no extra custom event (GTM already sends
      // begin_checkout).
      collect("checkout_start", "/checkout", { value: totalValue });
```

- [ ] **Step 7: Run the tests and type-check**

Run: `pnpm vitest run features/web-analytics lib/traffic-tracker.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 8: Check it in a browser**

The bot filter drops headless user agents, so pass a normal one:

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
agent-browser close >/dev/null 2>&1
agent-browser --user-agent "$UA" open "http://localhost:3001/?utm_source=plan-check"
agent-browser wait 4000
agent-browser eval "location.href = '/shop'"
agent-browser wait 4000
agent-browser eval "JSON.parse(localStorage.getItem('ss_session')).id"
agent-browser close
```

Use the printed session id (call it `<sid>`):

```bash
set -a && source .env && set +a
psql "$DATABASE_URL" -c "select type, path, utm_source, browser from analytics_events where session_id = '<sid>' order by ts"
psql "$DATABASE_URL" -c "delete from analytics_events where session_id = '<sid>'"
```

Expected: two `page_view` rows (`/` and `/shop`), both `utm_source = plan-check`, `Chrome 141`.

- [ ] **Step 9: Commit**

```bash
git add features/web-analytics/lib/collector.ts features/web-analytics/lib/collector.test.ts lib/traffic-tracker.ts lib/traffic-tracker.test.ts components/traffic-tracker.tsx "app/(client)/checkout/checkout-client.tsx"
git commit -m "feat(web-analytics): storefront collector beacons to /api/t"
```

---

### Task 6: Server-side order attribution

**Files:**
- Create: `features/web-analytics/server/record-order-event.ts`
- Modify: `features/checkout/server/route.ts`
- Modify: `features/checkout/api/use-checkout.ts`
- Test: `features/web-analytics/server/record-order-event.test.ts`

**Interfaces:**
- Consumes: `findLastSessionEvent`, `insertEvent`, `isAnalyticsEnabled`, `AnalyticsEvent`, `NewAnalyticsEvent` (Task 4); `toRoute`, `countryFromHeader` (Task 1); `getAnalyticsIds` (Task 5).
- Produces:
  - `interface OrderEventInput { orderId: string; value: number; visitorId?: string | null; sessionId?: string | null; headers: Headers }`
  - `interface OrderEventDeps { isEnabled: () => Promise<boolean>; findLast: (sessionId: string) => Promise<AnalyticsEvent | null>; insert: (row: NewAnalyticsEvent) => Promise<void> }`
  - `recordOrderEvent(input: OrderEventInput, deps?: OrderEventDeps): Promise<void>` (never rejects)

- [ ] **Step 1: Write the failing test**

`features/web-analytics/server/record-order-event.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { recordOrderEvent, type OrderEventDeps } from "./record-order-event";
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run features/web-analytics/server/record-order-event.test.ts`
Expected: FAIL. The suite cannot resolve `./record-order-event`.

- [ ] **Step 3: Implement**

`features/web-analytics/server/record-order-event.ts`:

```ts
import { parseUserAgent } from "@/lib/user-agent-parser";
import { countryFromHeader } from "../lib/request-info";
import { toRoute } from "../lib/route-pattern";
import {
  findLastSessionEvent,
  insertEvent,
  isAnalyticsEnabled,
  type AnalyticsEvent,
  type NewAnalyticsEvent,
} from "./store";

export interface OrderEventInput {
  orderId: string;
  value: number;
  visitorId?: string | null;
  sessionId?: string | null;
  headers: Headers;
}

export interface OrderEventDeps {
  isEnabled: () => Promise<boolean>;
  findLast: (sessionId: string) => Promise<AnalyticsEvent | null>;
  insert: (row: NewAnalyticsEvent) => Promise<void>;
}

const defaultDeps: OrderEventDeps = {
  isEnabled: isAnalyticsEnabled,
  findLast: findLastSessionEvent,
  insert: insertEvent,
};

/**
 * Records a website order as an `order_complete` analytics event, carrying
 * the visit's landing attributes so the dashboard can tie revenue to the
 * referrer or campaign that brought it. Revenue itself is always read back
 * from `orders`, so later cancellations and refunds are reflected. Never
 * rejects: a failure here must not affect the checkout that called it.
 */
export async function recordOrderEvent(input: OrderEventInput, deps: OrderEventDeps = defaultDeps): Promise<void> {
  try {
    if (!(await deps.isEnabled())) return;

    const sessionId = input.sessionId || `srv-${input.orderId}`;
    const visitorId = input.visitorId || sessionId;
    const last = input.sessionId ? await deps.findLast(input.sessionId) : null;
    const ua = parseUserAgent(input.headers.get("user-agent"));
    const path = last?.path ?? "/checkout";

    await deps.insert({
      type: "order_complete",
      visitorId,
      sessionId,
      path,
      route: toRoute(path),
      hostname: last?.hostname ?? null,
      referrerHost: last?.referrerHost ?? null,
      utmSource: last?.utmSource ?? null,
      utmMedium: last?.utmMedium ?? null,
      utmCampaign: last?.utmCampaign ?? null,
      utmTerm: last?.utmTerm ?? null,
      utmContent: last?.utmContent ?? null,
      adClick: last?.adClick ?? null,
      country: last?.country ?? countryFromHeader(input.headers.get("cf-ipcountry")),
      device: last?.device ?? ua.device,
      browser: last?.browser ?? ua.browser,
      os: last?.os ?? ua.os,
      label: null,
      productId: null,
      value: input.value,
      orderId: input.orderId,
    });
  } catch (err) {
    console.error("Analytics order event failed:", err);
  }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm vitest run features/web-analytics/server/record-order-event.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into checkout**

In `features/checkout/server/route.ts`:

1. Add imports after `import { expireStaleBkashOrders, … } from "@/lib/bkash-orders";`:

```ts
import { after } from "next/server";
import { recordOrderEvent } from "@/features/web-analytics/server/record-order-event";
```

2. In `checkoutSchema`, after `landingReferrer: z.string().optional(),`:

```ts
  // First-party analytics ids (features/web-analytics/lib/collector.ts), so
  // the order can be tied to the visit and campaign that produced it.
  analyticsVisitorId: z.string().trim().max(64).optional(),
  analyticsSessionId: z.string().trim().max(64).optional(),
```

3. Extend the destructuring in the POST handler:

```ts
  const { shippingInfo, paymentInfo, guestItems, idempotencyKey: rawKey, fbc, gclid, utmSource, utmMedium, utmCampaign, landingReferrer, analyticsVisitorId, analyticsSessionId } = c.req.valid("json");
```

4. **Logged-in branch.** Replace these lines

```ts
      const createdOrder = order;
      invalidateStockCache(soldOutProductIds(stockResult));
```

with

```ts
      const createdOrder = order;
      invalidateStockCache(soldOutProductIds(stockResult));

      // Ties this order to the visit that produced it. Runs after the
      // response and never fails the checkout. bKash orders are recorded now
      // too: an unpaid one ends up CANCELLED, which the dashboard excludes.
      const analyticsHeaders = c.req.raw.headers;
      after(() =>
        recordOrderEvent({
          orderId: order.id,
          value: totalAmount,
          visitorId: analyticsVisitorId,
          sessionId: analyticsSessionId,
          headers: analyticsHeaders,
        }),
      );
```

5. **Guest branch.** Replace

```ts
    const guestOrderId = order.id;
    invalidateStockCache(soldOutProductIds(stockResult));
```

with

```ts
    const guestOrderId = order.id;
    invalidateStockCache(soldOutProductIds(stockResult));

    // See the logged-in branch.
    const analyticsHeaders = c.req.raw.headers;
    after(() =>
      recordOrderEvent({
        orderId: order.id,
        value: totalAmount,
        visitorId: analyticsVisitorId,
        sessionId: analyticsSessionId,
        headers: analyticsHeaders,
      }),
    );
```

In `features/checkout/api/use-checkout.ts`:

1. Add `import { getAnalyticsIds } from "@/features/web-analytics/lib/collector";` after the `traffic-source` import.
2. After `const landing = getCapturedLandingSignals();` add `const analyticsIds = getAnalyticsIds();`.
3. In `payload`, after `landingReferrer: landing?.referrer,` add:

```ts
        analyticsVisitorId: analyticsIds?.visitorId,
        analyticsSessionId: analyticsIds?.sessionId,
```

`app/(client)/order-success/page.tsx` needs no change: `order_complete` is not a collector type, so `trackEvent` keeps sending it to GA4 only.

- [ ] **Step 6: Type-check and run all tests**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `pnpm vitest run`
Expected: PASS. The DB suites added in Task 7 don't exist yet.

- [ ] **Step 7: Commit**

```bash
git add features/web-analytics/server/record-order-event.ts features/web-analytics/server/record-order-event.test.ts features/checkout/server/route.ts features/checkout/api/use-checkout.ts
git commit -m "feat(web-analytics): attribute website orders to their visit"
```

---

### Task 7: Query layer, part 1: filters, KPIs, time series

**Files:**
- Create: `features/web-analytics/lib/dimensions.ts`
- Modify: `features/web-analytics/lib/types.ts` (append result types)
- Create: `features/web-analytics/server/filters.ts`
- Create: `features/web-analytics/server/queries.ts`
- Test: `features/web-analytics/server/queries.db.test.ts`

**Interfaces:**
- Consumes: `ANALYTICS_TZ`, `BucketUnit` (Task 1); `analyticsEvents`, `orders`, `orderItems`, `products` (schema); `db`, `Transaction` from `@/db`; `toRoute` (Task 1).
- Produces:
  - `DIMENSIONS`, `type Dimension`, `DIMENSION_KEYS`, `type Filters`, `NONE = "(none)"`, `activeFilters(filters): [Dimension, string][]` (`lib/dimensions.ts`)
  - `Kpis`, `SeriesPoint`, `BreakdownRow`, `Funnel`, `ProductRow`, `LiveSnapshot`, `OverviewResponse` (`lib/types.ts`)
  - `interface Range { start: Date; end: Date }`, `filterSql`, `inRange`, `qualifyingSessions`, `VALID_ORDER`, `ORDER_AMOUNT` (`server/filters.ts`)
  - `type Db`, `getKpis(ex: Db, r: Range, f: Filters): Promise<Kpis>`, `getSeries(ex: Db, r: Range, f: Filters, unit: BucketUnit): Promise<SeriesPoint[]>` (`server/queries.ts`)

- [ ] **Step 1: Dimensions and result types**

`features/web-analytics/lib/dimensions.ts`:

```ts
// Breakdown dimensions and dashboard filters. Keys are the API/URL names. The
// values are analytics_events columns, and they reach SQL only through this
// fixed map, never from request input.
export const DIMENSIONS = {
  path: "path",
  route: "route",
  hostname: "hostname",
  referrer: "referrer_host",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  country: "country",
  device: "device",
  browser: "browser",
  os: "os",
} as const;

export type Dimension = keyof typeof DIMENSIONS;
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as Dimension[];
export type Filters = Partial<Record<Dimension, string>>;

/** Filter value that matches rows where the column is empty ("Direct" for referrers). */
export const NONE = "(none)";

export function activeFilters(filters: Filters): [Dimension, string][] {
  return DIMENSION_KEYS.flatMap((key) => {
    const value = filters[key];
    return value ? [[key, value] as [Dimension, string]] : [];
  });
}
```

Append to `features/web-analytics/lib/types.ts`:

```ts
import type { BucketUnit } from "./buckets";

export interface Kpis {
  visitors: number;
  pageViews: number;
  sessions: number;
  bounced: number;
  bounceRate: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

/** One chart bucket. `bucket` is Dhaka wall-clock time, "YYYY-MM-DDTHH:mm:ss". */
export interface SeriesPoint {
  bucket: string;
  visitors: number;
  pageViews: number;
  sessions: number;
  bounced: number;
  orders: number;
  revenue: number;
}

export interface OverviewResponse {
  kpis: Kpis;
  previous: Kpis;
  series: SeriesPoint[];
  unit: BucketUnit;
}

export interface BreakdownRow {
  key: string | null;
  visitors: number;
  orders: number;
  revenue: number;
}

export interface Funnel {
  visited: number;
  viewedProduct: number;
  addedToCart: number;
  startedCheckout: number;
  ordered: number;
}

export interface ProductRow {
  productId: string;
  name: string;
  views: number;
  addedToCart: number;
  orders: number;
}

export interface LiveSnapshot {
  online: number;
  pages: { path: string; visitors: number }[];
}
```

(Move the `import type { BucketUnit }` line to the top of the file with the other imports.)

- [ ] **Step 2: SQL fragments**

`features/web-analytics/server/filters.ts`:

```ts
import { sql, type SQL } from "drizzle-orm";
import { activeFilters, DIMENSIONS, NONE, type Filters } from "../lib/dimensions";

export interface Range {
  start: Date;
  end: Date;
}

/** `AND <column> = <value>` for every active filter, columns from the fixed DIMENSIONS map. */
export function filterSql(filters: Filters): SQL {
  const parts = activeFilters(filters).map(([dim, value]) => {
    const column = sql.identifier(DIMENSIONS[dim]);
    return value === NONE ? sql`AND ${column} IS NULL` : sql`AND ${column} = ${value}`;
  });
  return parts.length ? sql.join(parts, sql` `) : sql``;
}

export function inRange(r: Range, column: SQL = sql`ts`): SQL {
  return sql`${column} >= ${r.start} AND ${column} <= ${r.end}`;
}

/** Sessions with at least one event in range matching every filter (spec §6). */
export function qualifyingSessions(r: Range, f: Filters): SQL {
  return sql`SELECT DISTINCT session_id FROM analytics_events WHERE ${inRange(r)} ${filterSql(f)}`;
}

// Same revenue rule as /analytics/sales-overview. Both expect `orders` aliased `ord`.
export const VALID_ORDER = sql.raw(`ord.status NOT IN ('CANCELLED', 'REFUNDED')`);
export const ORDER_AMOUNT = sql.raw(`ord."totalAmount" - COALESCE(ord."refundedAmount", 0)`);
```

- [ ] **Step 3: Write the failing DB test**

`features/web-analytics/server/queries.db.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { db, type Transaction } from "@/db";
import { analyticsEvents, orderItems, orders, products } from "@/db/schema";
import { toRoute } from "../lib/route-pattern";
import type { AnalyticsEventType } from "../lib/types";
import { NONE } from "../lib/dimensions";
import { getKpis, getSeries } from "./queries";
import type { NewAnalyticsEvent } from "./store";

// Runs against the local Docker Postgres:
//   set -a && source .env && set +a && RUN_DB_TESTS=1 pnpm vitest run features/web-analytics/server/queries.db.test.ts
// Every test seeds inside a transaction that is rolled back, so nothing persists.
const RUN = process.env.RUN_DB_TESTS === "1";

class Rollback extends Error {}

async function withRollback(fn: (tx: Transaction) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
}

// 2001: far from any real data in a copy of production.
const DAY_RANGE = {
  start: new Date("2001-03-10T00:00:00+06:00"),
  end: new Date("2001-03-11T23:59:59.999+06:00"),
};

function ev(e: {
  type: AnalyticsEventType;
  session: string;
  visitor: string;
  at: string;
  path?: string;
  referrerHost?: string | null;
  productId?: string;
  orderId?: string;
}): NewAnalyticsEvent {
  const path = e.path ?? "/";
  return {
    type: e.type,
    sessionId: e.session,
    visitorId: e.visitor,
    ts: new Date(e.at),
    path,
    route: toRoute(path),
    referrerHost: e.referrerHost ?? null,
    productId: e.productId ?? null,
    orderId: e.orderId ?? null,
    country: "BD",
    device: "Mobile",
    browser: "Chrome 141",
    os: "Android",
  };
}

async function seedOrder(
  tx: Transaction,
  id: string,
  totalAmount: number,
  opts: { status?: "PENDING" | "CANCELLED" | "REFUNDED"; refundedAmount?: number } = {},
) {
  await tx.insert(orders).values({
    id,
    orderNumber: `WA-TEST-${id}`,
    totalAmount,
    subtotal: totalAmount,
    shippingCost: 0,
    deliveryCharge: 0,
    tax: 0,
    paymentMethod: "COD",
    shippingAddress: "analytics test",
    status: opts.status ?? "PENDING",
    refundedAmount: opts.refundedAmount ?? 0,
  });
}

/**
 * s1 (v1, YouTube, Mar 10): two pages, views and carts a product, then an order that gets cancelled.
 * s2 (v2, direct,  Mar 10): one page (a bounce).
 * s3 (v1, YouTube, Mar 11): one page, checkout, a valid order (1000, 200 refunded) recorded twice.
 */
async function seedScenario(tx: Transaction): Promise<{ productId: string }> {
  const [product] = await tx.select({ id: products.id }).from(products).limit(1);
  if (!product) throw new Error("The local database has no products; these tests join order_items to a real product.");

  await seedOrder(tx, "wa-ord-cancelled", 500, { status: "CANCELLED" });
  await seedOrder(tx, "wa-ord-1", 1000, { refundedAmount: 200 });
  await tx.insert(orderItems).values({ orderId: "wa-ord-1", productId: product.id, quantity: 1, price: 1000 });

  const yt = "youtube.com";
  await tx.insert(analyticsEvents).values([
    ev({ type: "page_view", session: "wa-s1", visitor: "wa-v1", at: "2001-03-10T10:00:00+06:00", path: "/", referrerHost: yt }),
    ev({ type: "page_view", session: "wa-s1", visitor: "wa-v1", at: "2001-03-10T10:05:00+06:00", path: "/shop/a", referrerHost: yt }),
    ev({ type: "product_view", session: "wa-s1", visitor: "wa-v1", at: "2001-03-10T10:05:01+06:00", path: "/shop/a", referrerHost: yt, productId: product.id }),
    ev({ type: "add_to_cart", session: "wa-s1", visitor: "wa-v1", at: "2001-03-10T10:06:00+06:00", path: "/shop/a", referrerHost: yt, productId: product.id }),
    ev({ type: "order_complete", session: "wa-s1", visitor: "wa-v1", at: "2001-03-10T10:10:00+06:00", path: "/shop/a", referrerHost: yt, orderId: "wa-ord-cancelled" }),
    ev({ type: "page_view", session: "wa-s2", visitor: "wa-v2", at: "2001-03-10T11:00:00+06:00", path: "/" }),
    ev({ type: "page_view", session: "wa-s3", visitor: "wa-v1", at: "2001-03-11T09:00:00+06:00", path: "/shop/a", referrerHost: yt }),
    ev({ type: "checkout_start", session: "wa-s3", visitor: "wa-v1", at: "2001-03-11T09:05:00+06:00", path: "/checkout", referrerHost: yt }),
    ev({ type: "order_complete", session: "wa-s3", visitor: "wa-v1", at: "2001-03-11T09:10:00+06:00", path: "/checkout", referrerHost: yt, orderId: "wa-ord-1" }),
    ev({ type: "order_complete", session: "wa-s3", visitor: "wa-v1", at: "2001-03-11T09:11:00+06:00", path: "/checkout", referrerHost: yt, orderId: "wa-ord-1" }),
  ]);
  return { productId: product.id };
}

describe.skipIf(!RUN)("web analytics queries (database)", () => {
  it("computes the KPIs, counting a duplicated order once and net of refunds", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      expect(await getKpis(tx, DAY_RANGE, {})).toEqual({
        visitors: 2,
        pageViews: 4,
        sessions: 3,
        bounced: 2,
        bounceRate: 2 / 3,
        orders: 1,
        revenue: 800,
        conversionRate: 0.5,
      });
    });
  });

  it("applies referrer filters, including (none) for direct traffic", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      expect(await getKpis(tx, DAY_RANGE, { referrer: "youtube.com" })).toMatchObject({
        visitors: 1,
        pageViews: 3,
        sessions: 2,
        bounced: 1,
        orders: 1,
        revenue: 800,
      });
      expect(await getKpis(tx, DAY_RANGE, { referrer: NONE })).toMatchObject({
        visitors: 1,
        pageViews: 1,
        orders: 0,
        revenue: 0,
      });
    });
  });

  it("counts orders from sessions that viewed a filtered page", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      expect(await getKpis(tx, DAY_RANGE, { path: "/shop/a" })).toMatchObject({
        visitors: 1,
        pageViews: 2,
        sessions: 2,
        bounced: 1,
        orders: 1,
      });
    });
  });

  it("builds zero-filled daily and hourly series in Dhaka time", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      const daily = await getSeries(tx, DAY_RANGE, {}, "day");
      expect(daily).toEqual([
        { bucket: "2001-03-10T00:00:00", visitors: 2, pageViews: 3, sessions: 2, bounced: 1, orders: 0, revenue: 0 },
        { bucket: "2001-03-11T00:00:00", visitors: 1, pageViews: 1, sessions: 1, bounced: 1, orders: 1, revenue: 800 },
      ]);

      const hourly = await getSeries(tx, DAY_RANGE, {}, "hour");
      expect(hourly).toHaveLength(48);
      expect(hourly[0].bucket).toBe("2001-03-10T00:00:00");
      expect(hourly[47].bucket).toBe("2001-03-11T23:00:00");
      expect(hourly.reduce((sum, p) => sum + p.pageViews, 0)).toBe(4);
    });
  });

  it("puts a 23:30 Dhaka visit on that Dhaka day, not the UTC one", async () => {
    await withRollback(async (tx) => {
      await tx.insert(analyticsEvents).values([
        ev({ type: "page_view", session: "wa-s4", visitor: "wa-v4", at: "2001-03-10T23:30:00+06:00" }),
        ev({ type: "page_view", session: "wa-s5", visitor: "wa-v5", at: "2001-03-11T00:30:00+06:00" }),
      ]);
      const daily = await getSeries(tx, DAY_RANGE, {}, "day");
      expect(daily.map((p) => [p.bucket, p.pageViews])).toEqual([
        ["2001-03-10T00:00:00", 1],
        ["2001-03-11T00:00:00", 1],
      ]);
    });
  });

  it("starts month buckets on the 1st, even after a 31-day month", async () => {
    await withRollback(async (tx) => {
      await tx.insert(analyticsEvents).values([
        ev({ type: "page_view", session: "wa-s6", visitor: "wa-v6", at: "2001-01-31T23:00:00+06:00" }),
        ev({ type: "page_view", session: "wa-s7", visitor: "wa-v7", at: "2001-02-01T01:00:00+06:00" }),
        ev({ type: "page_view", session: "wa-s8", visitor: "wa-v8", at: "2001-03-31T22:00:00+06:00" }),
      ]);
      const range = { start: new Date("2001-01-01T00:00:00+06:00"), end: new Date("2001-03-31T23:59:59.999+06:00") };
      const monthly = await getSeries(tx, range, {}, "month");
      expect(monthly.map((p) => [p.bucket, p.pageViews])).toEqual([
        ["2001-01-01T00:00:00", 1],
        ["2001-02-01T00:00:00", 1],
        ["2001-03-01T00:00:00", 1],
      ]);
    });
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `set -a && source .env && set +a && RUN_DB_TESTS=1 pnpm vitest run features/web-analytics/server/queries.db.test.ts`
Expected: FAIL. The suite cannot resolve `./queries`.

(If seeding fails with a NOT NULL violation on `orders`, the table has gained a required column since this plan was written. Add that column to `seedOrder` with a dummy value. It is test data and is rolled back.)

- [ ] **Step 5: Implement the KPI and series queries**

`features/web-analytics/server/queries.ts`:

```ts
import { sql } from "drizzle-orm";
import type { db, Transaction } from "@/db";
import { ANALYTICS_TZ, type BucketUnit } from "../lib/buckets";
import type { Filters } from "../lib/dimensions";
import type { Kpis, SeriesPoint } from "../lib/types";
import { filterSql, inRange, ORDER_AMOUNT, qualifyingSessions, VALID_ORDER, type Range } from "./filters";

/** The app's db, or a transaction (the DB tests run every query inside one and roll it back). */
export type Db = typeof db | Transaction;

const num = (value: unknown): number => Number(value ?? 0) || 0;

export async function getKpis(ex: Db, r: Range, f: Filters): Promise<Kpis> {
  const { rows } = await ex.execute<{
    visitors: string;
    page_views: string;
    sessions: string;
    bounced: string;
    orders: string;
    revenue: string | null;
  }>(sql`
    WITH q AS (${qualifyingSessions(r, f)}),
    pv AS (
      SELECT visitor_id, session_id FROM analytics_events
      WHERE type = 'page_view' AND ${inRange(r)} ${filterSql(f)}
    ),
    s AS (
      SELECT e.session_id, count(*) AS page_count FROM analytics_events e
      WHERE e.type = 'page_view' AND ${inRange(r, sql`e.ts`)}
        AND e.session_id IN (SELECT session_id FROM pv)
      GROUP BY e.session_id
    ),
    o AS (
      SELECT DISTINCT ord.id, ${ORDER_AMOUNT} AS amount
      FROM analytics_events e JOIN orders ord ON ord.id = e.order_id
      WHERE e.type = 'order_complete' AND ${inRange(r, sql`e.ts`)}
        AND e.session_id IN (SELECT session_id FROM q) AND ${VALID_ORDER}
    )
    SELECT
      (SELECT count(DISTINCT visitor_id) FROM pv) AS visitors,
      (SELECT count(*) FROM pv) AS page_views,
      (SELECT count(*) FROM s) AS sessions,
      (SELECT count(*) FROM s WHERE page_count = 1) AS bounced,
      (SELECT count(*) FROM o) AS orders,
      (SELECT sum(amount) FROM o) AS revenue
  `);

  const row = rows[0];
  const visitors = num(row?.visitors);
  const sessions = num(row?.sessions);
  const bounced = num(row?.bounced);
  const ordersCount = num(row?.orders);
  return {
    visitors,
    pageViews: num(row?.page_views),
    sessions,
    bounced,
    bounceRate: sessions ? bounced / sessions : 0,
    orders: ordersCount,
    revenue: num(row?.revenue),
    conversionRate: visitors ? ordersCount / visitors : 0,
  };
}

export async function getSeries(ex: Db, r: Range, f: Filters, unit: BucketUnit): Promise<SeriesPoint[]> {
  const step = `1 ${unit}`;
  // Buckets are generated in Dhaka wall-clock time and converted back, so a
  // month step lands on the 1st (stepping in UTC would drift after 31-day months).
  const { rows } = await ex.execute<{
    bucket: string;
    visitors: string;
    page_views: string;
    sessions: string;
    bounced: string;
    orders: string;
    revenue: string | null;
  }>(sql`
    WITH q AS (${qualifyingSessions(r, f)}),
    buckets AS (
      SELECT g AT TIME ZONE ${ANALYTICS_TZ} AS bucket
      FROM generate_series(
        date_trunc(${unit}, ${r.start}::timestamptz, ${ANALYTICS_TZ}) AT TIME ZONE ${ANALYTICS_TZ},
        date_trunc(${unit}, ${r.end}::timestamptz, ${ANALYTICS_TZ}) AT TIME ZONE ${ANALYTICS_TZ},
        CAST(${step} AS interval)
      ) AS g
    ),
    pv AS (
      SELECT date_trunc(${unit}, ts, ${ANALYTICS_TZ}) AS bucket,
        count(DISTINCT visitor_id) AS visitors, count(*) AS page_views
      FROM analytics_events
      WHERE type = 'page_view' AND ${inRange(r)} ${filterSql(f)}
      GROUP BY 1
    ),
    s AS (
      SELECT date_trunc(${unit}, first_ts, ${ANALYTICS_TZ}) AS bucket,
        count(*) AS sessions, count(*) FILTER (WHERE page_count = 1) AS bounced
      FROM (
        SELECT e.session_id, min(e.ts) AS first_ts, count(*) AS page_count
        FROM analytics_events e
        WHERE e.type = 'page_view' AND ${inRange(r, sql`e.ts`)}
          AND e.session_id IN (
            SELECT session_id FROM analytics_events
            WHERE type = 'page_view' AND ${inRange(r)} ${filterSql(f)}
          )
        GROUP BY e.session_id
      ) per_session
      GROUP BY 1
    ),
    o AS (
      SELECT date_trunc(${unit}, first_ts, ${ANALYTICS_TZ}) AS bucket,
        count(*) AS orders, sum(amount) AS revenue
      FROM (
        SELECT ord.id, min(e.ts) AS first_ts, min(${ORDER_AMOUNT}) AS amount
        FROM analytics_events e JOIN orders ord ON ord.id = e.order_id
        WHERE e.type = 'order_complete' AND ${inRange(r, sql`e.ts`)}
          AND e.session_id IN (SELECT session_id FROM q) AND ${VALID_ORDER}
        GROUP BY ord.id
      ) per_order
      GROUP BY 1
    )
    SELECT
      to_char(b.bucket AT TIME ZONE ${ANALYTICS_TZ}, 'YYYY-MM-DD"T"HH24:MI:SS') AS bucket,
      COALESCE(pv.visitors, 0) AS visitors,
      COALESCE(pv.page_views, 0) AS page_views,
      COALESCE(s.sessions, 0) AS sessions,
      COALESCE(s.bounced, 0) AS bounced,
      COALESCE(o.orders, 0) AS orders,
      COALESCE(o.revenue, 0) AS revenue
    FROM buckets b
    LEFT JOIN pv ON pv.bucket = b.bucket
    LEFT JOIN s ON s.bucket = b.bucket
    LEFT JOIN o ON o.bucket = b.bucket
    ORDER BY b.bucket
  `);

  return rows.map((row) => ({
    bucket: row.bucket,
    visitors: num(row.visitors),
    pageViews: num(row.page_views),
    sessions: num(row.sessions),
    bounced: num(row.bounced),
    orders: num(row.orders),
    revenue: num(row.revenue),
  }));
}
```

(`GROUP BY 1` is deliberate. Repeating the `date_trunc(${unit}, …)` expression would bind `unit` as a second parameter, and Postgres refuses to match the two. See the comment in `features/analytics/server/route.ts` around `/sales-overview`.)

- [ ] **Step 6: Run the DB test to see it pass**

Run: `set -a && source .env && set +a && RUN_DB_TESTS=1 pnpm vitest run features/web-analytics/server/queries.db.test.ts`
Expected: PASS (6 tests).

Run: `pnpm vitest run features/web-analytics`
Expected: PASS, with the DB suite reported as skipped.

- [ ] **Step 7: Commit**

```bash
git add features/web-analytics/lib/dimensions.ts features/web-analytics/lib/types.ts features/web-analytics/server/filters.ts features/web-analytics/server/queries.ts features/web-analytics/server/queries.db.test.ts
git commit -m "feat(web-analytics): KPI and time-series queries"
```

---

### Task 8: Query layer, part 2: breakdowns, funnel, products, live

**Files:**
- Modify: `features/web-analytics/server/queries.ts` (append)
- Modify: `features/web-analytics/server/queries.db.test.ts` (append tests and imports)

**Interfaces:**
- Consumes: everything from Task 7.
- Produces:
  - `getBreakdown(ex: Db, r: Range, f: Filters, dim: Dimension, limit: number): Promise<BreakdownRow[]>`
  - `getFunnel(ex: Db, r: Range, f: Filters): Promise<Funnel>`
  - `getProducts(ex: Db, r: Range, f: Filters, limit: number): Promise<ProductRow[]>`
  - `getLive(ex: Db): Promise<LiveSnapshot>`

- [ ] **Step 1: Write the failing tests**

In `queries.db.test.ts`, change the queries import to:

```ts
import { getBreakdown, getFunnel, getKpis, getLive, getProducts, getSeries } from "./queries";
```

and add these tests inside the `describe.skipIf(!RUN)(…)` block:

```ts
  it("breaks visitors, orders and revenue down by referrer", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      expect(await getBreakdown(tx, DAY_RANGE, {}, "referrer", 10)).toEqual([
        { key: "youtube.com", visitors: 1, orders: 1, revenue: 800 },
        { key: null, visitors: 1, orders: 0, revenue: 0 },
      ]);
    });
  });

  it("breaks visitors down by page", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      const rows = await getBreakdown(tx, DAY_RANGE, {}, "path", 10);
      expect(rows.map((r) => [r.key, r.visitors])).toEqual([
        ["/", 2],
        ["/shop/a", 1],
      ]);
    });
  });

  it("builds the funnel, leaving out the cancelled order", async () => {
    await withRollback(async (tx) => {
      await seedScenario(tx);
      expect(await getFunnel(tx, DAY_RANGE, {})).toEqual({
        visited: 3,
        viewedProduct: 1,
        addedToCart: 1,
        startedCheckout: 1,
        ordered: 1,
      });
      expect(await getFunnel(tx, DAY_RANGE, { referrer: NONE })).toEqual({
        visited: 1,
        viewedProduct: 0,
        addedToCart: 0,
        startedCheckout: 0,
        ordered: 0,
      });
    });
  });

  it("lists products with views, carts and orders", async () => {
    await withRollback(async (tx) => {
      const { productId } = await seedScenario(tx);
      const rows = await getProducts(tx, DAY_RANGE, {}, 20);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ productId, views: 1, addedToCart: 1, orders: 1 });
      expect(typeof rows[0].name).toBe("string");
    });
  });

  it("reports who is online and the page each visitor is on now", async () => {
    await withRollback(async (tx) => {
      const before = await getLive(tx);
      const now = Date.now();
      await tx.insert(analyticsEvents).values([
        ev({ type: "page_view", session: "wa-l1", visitor: "wa-live-1", at: new Date(now).toISOString(), path: "/wa-live-a" }),
        ev({ type: "page_view", session: "wa-l2", visitor: "wa-live-2", at: new Date(now - 60_000).toISOString(), path: "/wa-live-c" }),
        ev({ type: "page_view", session: "wa-l2", visitor: "wa-live-2", at: new Date(now).toISOString(), path: "/wa-live-b" }),
        ev({ type: "page_view", session: "wa-l3", visitor: "wa-live-3", at: new Date(now - 10 * 60_000).toISOString(), path: "/wa-live-old" }),
      ]);
      const live = await getLive(tx);
      expect(live.online - before.online).toBe(2);
      expect(live.pages).toEqual(
        expect.arrayContaining([
          { path: "/wa-live-a", visitors: 1 },
          { path: "/wa-live-b", visitors: 1 },
        ]),
      );
      expect(live.pages.map((p) => p.path)).not.toContain("/wa-live-c");
      expect(live.pages.map((p) => p.path)).not.toContain("/wa-live-old");
    });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `set -a && source .env && set +a && RUN_DB_TESTS=1 pnpm vitest run features/web-analytics/server/queries.db.test.ts`
Expected: FAIL. `getBreakdown`, `getFunnel`, `getProducts` and `getLive` are not exported from `./queries`.

- [ ] **Step 3: Implement**

In `queries.ts`, update the imports:

```ts
import { DIMENSIONS, type Dimension, type Filters } from "../lib/dimensions";
import type { BreakdownRow, Funnel, Kpis, LiveSnapshot, ProductRow, SeriesPoint } from "../lib/types";
```

(Replace the earlier `import type { Filters }` and `import type { Kpis, SeriesPoint }` lines with these.) Then append:

```ts
export async function getBreakdown(
  ex: Db,
  r: Range,
  f: Filters,
  dim: Dimension,
  limit: number,
): Promise<BreakdownRow[]> {
  const column = sql.identifier(DIMENSIONS[dim]);
  // Order events carry the session's landing attributes, so grouping them by
  // the same column attributes each order to its referrer / campaign.
  const { rows } = await ex.execute<{ key: string | null; visitors: string; orders: string; revenue: string | null }>(sql`
    WITH q AS (${qualifyingSessions(r, f)}),
    v AS (
      SELECT ${column} AS key, count(DISTINCT visitor_id) AS visitors
      FROM analytics_events
      WHERE type = 'page_view' AND ${inRange(r)} ${filterSql(f)}
      GROUP BY 1
    ),
    o AS (
      SELECT key, count(*) AS orders, sum(amount) AS revenue
      FROM (
        SELECT DISTINCT ON (ord.id) e.${column} AS key, ${ORDER_AMOUNT} AS amount
        FROM analytics_events e JOIN orders ord ON ord.id = e.order_id
        WHERE e.type = 'order_complete' AND ${inRange(r, sql`e.ts`)}
          AND e.session_id IN (SELECT session_id FROM q) AND ${VALID_ORDER}
        ORDER BY ord.id, e.ts
      ) per_order
      GROUP BY 1
    )
    SELECT v.key, v.visitors, COALESCE(o.orders, 0) AS orders, COALESCE(o.revenue, 0) AS revenue
    FROM v LEFT JOIN o ON o.key IS NOT DISTINCT FROM v.key
    ORDER BY v.visitors DESC, v.key ASC NULLS LAST
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    key: row.key,
    visitors: num(row.visitors),
    orders: num(row.orders),
    revenue: num(row.revenue),
  }));
}

export async function getFunnel(ex: Db, r: Range, f: Filters): Promise<Funnel> {
  const { rows } = await ex.execute<{
    visited: string;
    viewed_product: string;
    added_to_cart: string;
    started_checkout: string;
    ordered: string;
  }>(sql`
    WITH q AS (${qualifyingSessions(r, f)}),
    ev AS (
      SELECT e.session_id, e.type, e.order_id FROM analytics_events e
      WHERE ${inRange(r, sql`e.ts`)} AND e.session_id IN (SELECT session_id FROM q)
    )
    SELECT
      count(DISTINCT session_id) FILTER (WHERE type = 'page_view') AS visited,
      count(DISTINCT session_id) FILTER (WHERE type = 'product_view') AS viewed_product,
      count(DISTINCT session_id) FILTER (WHERE type IN ('add_to_cart', 'buy_now')) AS added_to_cart,
      count(DISTINCT session_id) FILTER (WHERE type = 'checkout_start') AS started_checkout,
      (
        SELECT count(DISTINCT ev.session_id) FROM ev JOIN orders ord ON ord.id = ev.order_id
        WHERE ev.type = 'order_complete' AND ${VALID_ORDER}
      ) AS ordered
    FROM ev
  `);
  const row = rows[0];
  return {
    visited: num(row?.visited),
    viewedProduct: num(row?.viewed_product),
    addedToCart: num(row?.added_to_cart),
    startedCheckout: num(row?.started_checkout),
    ordered: num(row?.ordered),
  };
}

export async function getProducts(ex: Db, r: Range, f: Filters, limit: number): Promise<ProductRow[]> {
  const { rows } = await ex.execute<{ product_id: string; name: string; views: string; added: string; orders: string }>(sql`
    WITH q AS (${qualifyingSessions(r, f)}),
    a AS (
      SELECT product_id,
        count(DISTINCT session_id) FILTER (WHERE type = 'product_view') AS views,
        count(DISTINCT session_id) FILTER (WHERE type IN ('add_to_cart', 'buy_now')) AS added
      FROM analytics_events
      WHERE ${inRange(r)} AND product_id IS NOT NULL
        AND type IN ('product_view', 'add_to_cart', 'buy_now')
        AND session_id IN (SELECT session_id FROM q)
      GROUP BY product_id
    ),
    b AS (
      SELECT oi."productId" AS product_id, count(DISTINCT ord.id) AS orders
      FROM analytics_events e
      JOIN orders ord ON ord.id = e.order_id
      JOIN order_items oi ON oi."orderId" = ord.id
      WHERE e.type = 'order_complete' AND ${inRange(r, sql`e.ts`)}
        AND e.session_id IN (SELECT session_id FROM q) AND ${VALID_ORDER}
      GROUP BY 1
    )
    SELECT a.product_id, p.name, a.views, a.added, COALESCE(b.orders, 0) AS orders
    FROM a
    JOIN products p ON p.id = a.product_id
    LEFT JOIN b ON b.product_id = a.product_id
    ORDER BY a.views DESC, a.added DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    productId: row.product_id,
    name: row.name,
    views: num(row.views),
    addedToCart: num(row.added),
    orders: num(row.orders),
  }));
}

/** Visitors with any event in the last 5 minutes, and the page each last viewed. */
export async function getLive(ex: Db): Promise<LiveSnapshot> {
  const online = await ex.execute<{ online: string }>(sql`
    SELECT count(DISTINCT visitor_id) AS online FROM analytics_events
    WHERE ts > now() - interval '5 minutes'
  `);
  const pages = await ex.execute<{ path: string; visitors: string }>(sql`
    SELECT path, count(*) AS visitors
    FROM (
      SELECT DISTINCT ON (visitor_id) visitor_id, path FROM analytics_events
      WHERE type = 'page_view' AND ts > now() - interval '5 minutes'
      ORDER BY visitor_id, ts DESC
    ) latest
    GROUP BY path
    ORDER BY visitors DESC, path ASC
    LIMIT 10
  `);
  return {
    online: num(online.rows[0]?.online),
    pages: pages.rows.map((row) => ({ path: row.path, visitors: num(row.visitors) })),
  };
}
```

- [ ] **Step 4: Run the DB tests to see them pass**

Run: `set -a && source .env && set +a && RUN_DB_TESTS=1 pnpm vitest run features/web-analytics/server/queries.db.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add features/web-analytics/server/queries.ts features/web-analytics/server/queries.db.test.ts
git commit -m "feat(web-analytics): breakdown, funnel, products and live queries"
```

---

### Task 9: Dashboard API and React Query hooks

**Files:**
- Create: `lib/analytics-access.ts`
- Modify: `features/analytics/server/route.ts` (remove the local `canViewAnalytics` and its `permissions` import)
- Modify: `lib/analytics-access.test.ts` (test the real function)
- Create: `features/web-analytics/server/query-params.ts`
- Create: `features/web-analytics/server/route.ts`
- Modify: `app/api/[[...route]]/route.ts`
- Create: `features/web-analytics/api/use-web-analytics.ts`
- Test: `features/web-analytics/server/query-params.test.ts`

**Interfaces:**
- Consumes: query functions (Tasks 7–8), `bucketUnit` (Task 1), `getPreviousRange` from `@/lib/date-utils`, `sessionMiddleware`, `client` from `@/lib/rpc`.
- Produces:
  - `canViewAnalytics(user): boolean` (`lib/analytics-access.ts`)
  - `rangeQuerySchema`, `breakdownQuerySchema`, `productsQuerySchema`, `type RangeQuery`, `toRangeAndFilters(q: RangeQuery): { range: Range; filters: Filters } | null`
  - `GET /api/web-analytics/{overview,breakdown,funnel,products,live}`
  - Hooks: `interface WaQuery { from: string; to: string; filters: Filters }`, `useWaOverview(q)`, `useWaBreakdown(q, dim)`, `useWaFunnel(q)`, `useWaProducts(q)`, `useWaLive()`

- [ ] **Step 1: Share `canViewAnalytics`**

`lib/analytics-access.ts`:

```ts
import { can, isAllowed } from "@/lib/permissions";

/**
 * Who may read store-wide analytics.
 *
 * Every handler in features/analytics used to check only "is anyone logged
 * in". Signup is public and self-serve, and a new account gets role USER with
 * no permissions — so any of the store's registered customers could call those
 * endpoints and read revenue, customer lifetime value, cohort retention,
 * spending segments, stock levels and the most recent orders with the
 * customers' names on them. Every other dashboard route in the app already
 * gated on a permission; that one was simply missed.
 *
 * Accepts `reports:read` as well as `dashboard:read` on purpose. The two are
 * separate modules, and a role can legitimately carry either: the store's own
 * "Owner" role holds reports:read without dashboard:read, and requiring only
 * the latter would have locked it out of the dashboard it is named for.
 * ADMIN passes via can(); MODERATOR is bypassed the same way the orders
 * routes bypass it.
 *
 * Shared by features/analytics and features/web-analytics.
 */
export function canViewAnalytics(user: Parameters<typeof can>[0]): boolean {
  return isAllowed(user, "dashboard", "read", ["MODERATOR"]) || can(user, "reports", "read");
}
```

In `features/analytics/server/route.ts`, delete the doc comment and `function canViewAnalytics(…) { … }` (lines 10–33), replace `import { can, isAllowed } from "@/lib/permissions";` with `import { canViewAnalytics } from "@/lib/analytics-access";`, and check that nothing else in the file used `can` or `isAllowed`: `grep -n "can(\|isAllowed(" features/analytics/server/route.ts` should list only `canViewAnalytics(` call sites.

In `lib/analytics-access.test.ts`, replace the top of the file (the imports and the mirrored `const canViewAnalytics = …` with its comment) with:

```ts
import { describe, it, expect } from "vitest";
import { canViewAnalytics } from "./analytics-access";
```

The rest of the file stays as it is.

Run: `pnpm vitest run lib/analytics-access.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 2: Write the failing query-params test**

`features/web-analytics/server/query-params.test.ts`:

```ts
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
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm vitest run features/web-analytics/server/query-params.test.ts`
Expected: FAIL. The suite cannot resolve `./query-params`.

- [ ] **Step 4: Implement the query parsing**

`features/web-analytics/server/query-params.ts`:

```ts
import { z } from "zod";
import { DIMENSION_KEYS, type Dimension, type Filters } from "../lib/dimensions";
import type { Range } from "./filters";

const MAX_RANGE_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

const filterShape = Object.fromEntries(
  DIMENSION_KEYS.map((key) => [key, z.string().trim().max(300).optional()]),
) as Record<Dimension, z.ZodOptional<z.ZodString>>;

export const rangeQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  ...filterShape,
});

export const breakdownQuerySchema = rangeQuerySchema.extend({
  dim: z.enum(DIMENSION_KEYS as [Dimension, ...Dimension[]]),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const productsQuerySchema = rangeQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type RangeQuery = z.infer<typeof rangeQuerySchema>;

export function toRangeAndFilters(q: RangeQuery): { range: Range; filters: Filters } | null {
  const start = new Date(q.from);
  const end = new Date(q.to);
  if (!(start <= end) || end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) return null;
  const filters: Filters = {};
  for (const key of DIMENSION_KEYS) {
    const value = q[key];
    if (value) filters[key] = value;
  }
  return { range: { start, end }, filters };
}
```

Run: `pnpm vitest run features/web-analytics/server/query-params.test.ts`
Expected: PASS.

- [ ] **Step 5: The dashboard route**

`features/web-analytics/server/route.ts`:

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@/db";
import { sessionMiddleware } from "@/lib/session-middleware";
import { canViewAnalytics } from "@/lib/analytics-access";
import { getPreviousRange } from "@/lib/date-utils";
import { bucketUnit } from "../lib/buckets";
import { getBreakdown, getFunnel, getKpis, getLive, getProducts, getSeries } from "./queries";
import { breakdownQuerySchema, productsQuerySchema, rangeQuerySchema, toRangeAndFilters } from "./query-params";

const unauthorized = { error: "Unauthorized" } as const;
const invalidRange = { error: "Invalid date range" } as const;
const failed = { error: "Failed to load analytics" } as const;

const app = new Hono()
  .get("/overview", sessionMiddleware, zValidator("query", rangeQuerySchema), async (c) => {
    if (!canViewAnalytics(c.get("user"))) return c.json(unauthorized, 403);
    const parsed = toRangeAndFilters(c.req.valid("query"));
    if (!parsed) return c.json(invalidRange, 400);
    const { range, filters } = parsed;
    const prev = getPreviousRange(range.start, range.end);
    const unit = bucketUnit(range.start, range.end);
    try {
      const [kpis, previous, series] = await Promise.all([
        getKpis(db, range, filters),
        getKpis(db, { start: prev.startDate, end: prev.endDate }, filters),
        getSeries(db, range, filters, unit),
      ]);
      return c.json({ kpis, previous, series, unit });
    } catch (err) {
      console.error("Web analytics overview failed:", err);
      return c.json(failed, 500);
    }
  })
  .get("/breakdown", sessionMiddleware, zValidator("query", breakdownQuerySchema), async (c) => {
    if (!canViewAnalytics(c.get("user"))) return c.json(unauthorized, 403);
    const query = c.req.valid("query");
    const parsed = toRangeAndFilters(query);
    if (!parsed) return c.json(invalidRange, 400);
    try {
      const rows = await getBreakdown(db, parsed.range, parsed.filters, query.dim, query.limit);
      return c.json({ rows });
    } catch (err) {
      console.error("Web analytics breakdown failed:", err);
      return c.json(failed, 500);
    }
  })
  .get("/funnel", sessionMiddleware, zValidator("query", rangeQuerySchema), async (c) => {
    if (!canViewAnalytics(c.get("user"))) return c.json(unauthorized, 403);
    const parsed = toRangeAndFilters(c.req.valid("query"));
    if (!parsed) return c.json(invalidRange, 400);
    try {
      return c.json(await getFunnel(db, parsed.range, parsed.filters));
    } catch (err) {
      console.error("Web analytics funnel failed:", err);
      return c.json(failed, 500);
    }
  })
  .get("/products", sessionMiddleware, zValidator("query", productsQuerySchema), async (c) => {
    if (!canViewAnalytics(c.get("user"))) return c.json(unauthorized, 403);
    const query = c.req.valid("query");
    const parsed = toRangeAndFilters(query);
    if (!parsed) return c.json(invalidRange, 400);
    try {
      const rows = await getProducts(db, parsed.range, parsed.filters, query.limit);
      return c.json({ rows });
    } catch (err) {
      console.error("Web analytics products failed:", err);
      return c.json(failed, 500);
    }
  })
  .get("/live", sessionMiddleware, async (c) => {
    if (!canViewAnalytics(c.get("user"))) return c.json(unauthorized, 403);
    try {
      return c.json(await getLive(db));
    } catch (err) {
      console.error("Web analytics live failed:", err);
      return c.json(failed, 500);
    }
  });

export default app;
```

In `app/api/[[...route]]/route.ts`, add `import webAnalytics from "@/features/web-analytics/server/route";` next to the collect import, and `.route("/web-analytics",webAnalytics)` after `.route("/t", webAnalyticsCollect)`.

- [ ] **Step 6: Hooks**

`features/web-analytics/api/use-web-analytics.ts`:

```ts
"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import type { Dimension, Filters } from "../lib/dimensions";
import type { BreakdownRow, Funnel, LiveSnapshot, OverviewResponse, ProductRow } from "../lib/types";

export interface WaQuery {
  from: string;
  to: string;
  filters: Filters;
}

const api = client.api["web-analytics"];
const params = (q: WaQuery) => ({ from: q.from, to: q.to, ...q.filters });

export const useWaOverview = (q: WaQuery) =>
  useQuery({
    queryKey: ["web-analytics", "overview", q],
    queryFn: async () => {
      const res = await api.overview.$get({ query: params(q) });
      if (!res.ok) throw new Error("Failed to load analytics");
      return (await res.json()) as OverviewResponse;
    },
    placeholderData: keepPreviousData,
  });

export const useWaBreakdown = (q: WaQuery, dim: Dimension) =>
  useQuery({
    queryKey: ["web-analytics", "breakdown", dim, q],
    queryFn: async () => {
      const res = await api.breakdown.$get({ query: { ...params(q), dim, limit: "10" } });
      if (!res.ok) throw new Error("Failed to load breakdown");
      return (await res.json()) as { rows: BreakdownRow[] };
    },
    placeholderData: keepPreviousData,
  });

export const useWaFunnel = (q: WaQuery) =>
  useQuery({
    queryKey: ["web-analytics", "funnel", q],
    queryFn: async () => {
      const res = await api.funnel.$get({ query: params(q) });
      if (!res.ok) throw new Error("Failed to load funnel");
      return (await res.json()) as Funnel;
    },
    placeholderData: keepPreviousData,
  });

export const useWaProducts = (q: WaQuery) =>
  useQuery({
    queryKey: ["web-analytics", "products", q],
    queryFn: async () => {
      const res = await api.products.$get({ query: { ...params(q), limit: "20" } });
      if (!res.ok) throw new Error("Failed to load products");
      return (await res.json()) as { rows: ProductRow[] };
    },
    placeholderData: keepPreviousData,
  });

export const useWaLive = () =>
  useQuery({
    queryKey: ["web-analytics", "live"],
    queryFn: async () => {
      const res = await api.live.$get();
      if (!res.ok) throw new Error("Failed to load live visitors");
      return (await res.json()) as LiveSnapshot;
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
```

- [ ] **Step 7: Type-check, test, smoke**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `pnpm vitest run`
Expected: PASS, with the DB suite skipped.

Run (dev server up):

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/web-analytics/overview?from=2026-10-01T00:00:00.000Z&to=2026-10-07T23:59:59.999Z"
```

Expected: `403` without a session cookie.

- [ ] **Step 8: Commit**

```bash
git add lib/analytics-access.ts lib/analytics-access.test.ts features/analytics/server/route.ts features/web-analytics "app/api/[[...route]]/route.ts"
git commit -m "feat(web-analytics): dashboard API and query hooks"
```

---

### Task 10: Dashboard shell: tabs, header, KPI cards, chart

**Files:**
- Create: `features/web-analytics/lib/format.ts`
- Create: `features/web-analytics/components/tracking-toggle.tsx`
- Create: `features/web-analytics/components/live-badge.tsx`
- Create: `features/web-analytics/components/filter-chips.tsx`
- Create: `features/web-analytics/components/kpi-cards.tsx`
- Create: `features/web-analytics/components/trend-chart.tsx`
- Create: `features/web-analytics/components/web-analytics-dashboard.tsx`
- Create: `app/(dashboard)/dashboard/analytics/analytics-tabs.tsx`
- Modify: `app/(dashboard)/dashboard/analytics/page.tsx`
- Test: `features/web-analytics/lib/format.test.ts`

**Interfaces:**
- Consumes: hooks (Task 9); `Kpis`, `SeriesPoint` (Task 7); `Dimension`, `Filters`, `NONE`, `activeFilters`, `DIMENSION_KEYS` (Task 7); `BucketUnit` (Task 1); `useSettings`, `useUpdateSettings`; `useCurrent`; `can`; `useCurrency`; UI primitives (`Card`, `Button`, `Switch`, `Popover*`, `Skeleton`, `Tabs*`, `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `DateRangePicker`).
- Produces:
  - `RANGE_PRESETS`, `type RangePreset`, `presetRange(preset, now): { from: string; to: string }`
  - `METRICS`, `type Metric`, `METRIC_LABELS`, `kpiValue(k, m)`, `pointValue(p, m)`, `trendPercent(current, previous): number | null`, `formatPercent(ratio)`, `formatCount(n)`, `bucketLabel(bucket, unit)`, `DIMENSION_LABELS`, `keyLabel(dim, key)`, `filterValueLabel(dim, value)`
  - `<WebAnalyticsDashboard />`, `<TrackingToggle />`, `<TrackingOffBanner />`, `<LiveBadge />`, `<FilterChips />`, `<KpiCards />`, `<TrendChart />`

- [ ] **Step 1: Write the failing format test**

`features/web-analytics/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  bucketLabel,
  filterValueLabel,
  formatPercent,
  keyLabel,
  pointValue,
  presetRange,
  trendPercent,
} from "./format";
import { NONE } from "./dimensions";
import type { SeriesPoint } from "./types";

describe("presetRange", () => {
  const now = new Date(2026, 9, 10, 15, 30); // local time, Oct 10 15:30

  it("covers today from local midnight to the end of the day", () => {
    expect(presetRange("today", now)).toEqual({
      from: new Date(2026, 9, 10, 0, 0, 0, 0).toISOString(),
      to: new Date(2026, 9, 10, 23, 59, 59, 999).toISOString(),
    });
  });

  it("counts today as one of the last 7 days", () => {
    expect(presetRange("7d", now).from).toBe(new Date(2026, 9, 4, 0, 0, 0, 0).toISOString());
    expect(presetRange("90d", now).from).toBe(new Date(2026, 6, 13, 0, 0, 0, 0).toISOString());
  });
});

describe("trendPercent", () => {
  it("compares with the previous period", () => {
    expect(trendPercent(110, 100)).toBe(10);
    expect(trendPercent(90, 100)).toBe(-10);
    expect(trendPercent(0, 0)).toBe(0);
  });

  it("has no percentage when the previous period was zero", () => {
    expect(trendPercent(5, 0)).toBeNull();
  });
});

describe("formatPercent", () => {
  it("rounds to whole percent, keeping a decimal under 10%", () => {
    expect(formatPercent(2 / 3)).toBe("67%");
    expect(formatPercent(0.05)).toBe("5.0%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("pointValue", () => {
  const point: SeriesPoint = { bucket: "", visitors: 4, pageViews: 9, sessions: 4, bounced: 1, orders: 1, revenue: 800 };

  it("derives bounce and conversion rates per bucket", () => {
    expect(pointValue(point, "bounceRate")).toBe(0.25);
    expect(pointValue(point, "conversionRate")).toBe(0.25);
    expect(pointValue(point, "revenue")).toBe(800);
  });

  it("returns 0 rather than NaN for empty buckets", () => {
    const empty = { ...point, visitors: 0, sessions: 0, bounced: 0, orders: 0 };
    expect(pointValue(empty, "bounceRate")).toBe(0);
    expect(pointValue(empty, "conversionRate")).toBe(0);
  });
});

describe("bucketLabel", () => {
  it("labels hours, days and months", () => {
    expect(bucketLabel("2026-10-10T14:00:00", "hour")).toBe("14:00");
    expect(bucketLabel("2026-10-03T00:00:00", "day")).toBe("Oct 3");
    expect(bucketLabel("2026-10-01T00:00:00", "month")).toBe("Oct 2026");
  });
});

describe("keyLabel / filterValueLabel", () => {
  it("names empty values by dimension", () => {
    expect(keyLabel("referrer", null)).toBe("Direct");
    expect(keyLabel("utmSource", null)).toBe("(not set)");
    expect(keyLabel("country", null)).toBe("Unknown");
    expect(keyLabel("path", "/shop")).toBe("/shop");
    expect(filterValueLabel("referrer", NONE)).toBe("Direct");
    expect(filterValueLabel("referrer", "youtube.com")).toBe("youtube.com");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run features/web-analytics/lib/format.test.ts`
Expected: FAIL. The suite cannot resolve `./format`.

- [ ] **Step 3: Implement the formatting helpers**

`features/web-analytics/lib/format.ts`:

```ts
import { endOfDay, startOfDay, subDays } from "date-fns";
import type { BucketUnit } from "./buckets";
import { NONE, type Dimension } from "./dimensions";
import type { Kpis, SeriesPoint } from "./types";

export type RangePreset = "today" | "7d" | "30d" | "90d" | "custom";
type FixedPreset = Exclude<RangePreset, "custom">;

export const RANGE_PRESETS: { value: FixedPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const PRESET_DAYS: Record<FixedPreset, number> = { today: 0, "7d": 6, "30d": 29, "90d": 89 };

/** Local (browser) day boundaries; the admin's browser runs on Dhaka time. */
export function presetRange(preset: FixedPreset, now: Date): { from: string; to: string } {
  return {
    from: startOfDay(subDays(now, PRESET_DAYS[preset])).toISOString(),
    to: endOfDay(now).toISOString(),
  };
}

export const METRICS = ["visitors", "pageViews", "bounceRate", "orders", "revenue", "conversionRate"] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_LABELS: Record<Metric, string> = {
  visitors: "Visitors",
  pageViews: "Page views",
  bounceRate: "Bounce rate",
  orders: "Website orders",
  revenue: "Revenue",
  conversionRate: "Conversion rate",
};

export function kpiValue(kpis: Kpis, metric: Metric): number {
  return kpis[metric];
}

export function pointValue(point: SeriesPoint, metric: Metric): number {
  switch (metric) {
    case "bounceRate":
      return point.sessions ? point.bounced / point.sessions : 0;
    case "conversionRate":
      return point.visitors ? point.orders / point.visitors : 0;
    default:
      return point[metric];
  }
}

export function trendPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function formatPercent(ratio: number): string {
  const percent = ratio * 100;
  return `${percent > 0 && percent < 10 ? percent.toFixed(1) : Math.round(percent)}%`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Labels a SeriesPoint bucket ("YYYY-MM-DDTHH:mm:ss", Dhaka wall clock). */
export function bucketLabel(bucket: string, unit: BucketUnit): string {
  const [date, time = "00"] = bucket.split("T");
  const [year, month, day] = date.split("-").map(Number);
  if (unit === "hour") return `${time.slice(0, 2)}:00`;
  if (unit === "day") return `${MONTHS[month - 1]} ${day}`;
  return `${MONTHS[month - 1]} ${year}`;
}

export const DIMENSION_LABELS: Record<Dimension, string> = {
  path: "Page",
  route: "Route",
  hostname: "Hostname",
  referrer: "Referrer",
  utmSource: "UTM source",
  utmMedium: "UTM medium",
  utmCampaign: "UTM campaign",
  country: "Country",
  device: "Device",
  browser: "Browser",
  os: "OS",
};

export function keyLabel(dim: Dimension, key: string | null): string {
  if (key) return key;
  if (dim === "referrer") return "Direct";
  if (dim === "utmSource" || dim === "utmMedium" || dim === "utmCampaign") return "(not set)";
  return "Unknown";
}

export function filterValueLabel(dim: Dimension, value: string): string {
  return value === NONE ? keyLabel(dim, null) : value;
}
```

Run: `pnpm vitest run features/web-analytics/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 4: Header components**

`features/web-analytics/components/tracking-toggle.tsx`:

```tsx
"use client";

import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { useCurrent } from "@/features/auth/api/use-current";
import { can } from "@/lib/permissions";

export function useTrackingEnabled(): boolean {
  const { data: settings } = useSettings();
  return settings?.analytics_enabled !== "false";
}

export function TrackingToggle() {
  const enabled = useTrackingEnabled();
  const { data: user } = useCurrent();
  const update = useUpdateSettings();
  // The PATCH checks settings:write too; this only greys the switch out.
  const canEdit = can((user ?? null) as Parameters<typeof can>[0], "settings", "write");

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Tracking</span>
      <Switch
        checked={enabled}
        disabled={!canEdit || update.isPending}
        onCheckedChange={(checked) => update.mutate({ analytics_enabled: checked ? "true" : "false" })}
      />
      <span className="w-6 font-medium">{enabled ? "On" : "Off"}</span>
    </label>
  );
}

export function TrackingOffBanner() {
  const enabled = useTrackingEnabled();
  if (enabled) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      Tracking is off. New visits aren&apos;t being recorded; the numbers below are what was stored before it was
      switched off.
    </div>
  );
}
```

`features/web-analytics/components/live-badge.tsx`:

```tsx
"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useWaLive } from "../api/use-web-analytics";

export function LiveBadge() {
  const { data } = useWaLive();
  const online = data?.online ?? 0;

  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
        <span className={cn("h-2 w-2 rounded-full", online > 0 ? "bg-emerald-500" : "bg-muted-foreground/40")} />
        <span className="tabular-nums">{online}</span> online
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="mb-2 text-sm font-medium">Active in the last 5 minutes</p>
        {data?.pages.length ? (
          <ul className="space-y-1 text-sm">
            {data.pages.map((page) => (
              <li key={page.path} className="flex justify-between gap-2">
                <span className="truncate">{page.path}</span>
                <span className="tabular-nums text-muted-foreground">{page.visitors}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nobody right now.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

`features/web-analytics/components/filter-chips.tsx`:

```tsx
"use client";

import { X } from "lucide-react";
import { activeFilters, type Dimension, type Filters } from "../lib/dimensions";
import { DIMENSION_LABELS, filterValueLabel } from "../lib/format";

export function FilterChips({ filters, onRemove }: { filters: Filters; onRemove: (dim: Dimension) => void }) {
  const active = activeFilters(filters);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {active.map(([dim, value]) => (
        <button
          key={dim}
          type="button"
          onClick={() => onRemove(dim)}
          className="flex items-center gap-1 rounded-full border bg-muted/40 px-3 py-1 text-xs"
        >
          <span className="text-muted-foreground">{DIMENSION_LABELS[dim]}:</span>
          <span className="font-medium">{filterValueLabel(dim, value)}</span>
          <X className="h-3 w-3" aria-label="Remove filter" />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: KPI cards and chart**

First check that the chart colour variable exists: `grep -n -- "--chart-1" app/globals.css`. If nothing prints, use `var(--primary)` in place of `var(--chart-1)` below.

`features/web-analytics/components/kpi-cards.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { useWaOverview, type WaQuery } from "../api/use-web-analytics";
import { formatCount, formatPercent, kpiValue, METRIC_LABELS, METRICS, trendPercent, type Metric } from "../lib/format";

const LOWER_IS_BETTER: ReadonlySet<Metric> = new Set<Metric>(["bounceRate"]);

export function KpiCards({ q, metric, onSelect }: { q: WaQuery; metric: Metric; onSelect: (metric: Metric) => void }) {
  const { data, isLoading } = useWaOverview(q);
  const { formatAmount } = useCurrency();

  const format = (m: Metric, value: number) =>
    m === "revenue" ? formatAmount(value) : m === "bounceRate" || m === "conversionRate" ? formatPercent(value) : formatCount(value);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {METRICS.map((m) => {
        const value = data ? kpiValue(data.kpis, m) : 0;
        const trend = data ? trendPercent(value, kpiValue(data.previous, m)) : null;
        const good = trend !== null && (LOWER_IS_BETTER.has(m) ? trend < 0 : trend > 0);
        return (
          <button key={m} type="button" onClick={() => onSelect(m)} className="text-left">
            <Card className={cn("gap-1 p-4 transition-colors", metric === m ? "ring-2 ring-primary" : "hover:bg-muted/50")}>
              <span className="text-xs text-muted-foreground">{METRIC_LABELS[m]}</span>
              {isLoading && !data ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{format(m, value)}</span>
                  {trend !== null && trend !== 0 && (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-xs font-medium",
                        good ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600",
                      )}
                    >
                      {trend > 0 ? "+" : ""}
                      {Math.round(trend)}%
                    </span>
                  )}
                </div>
              )}
            </Card>
          </button>
        );
      })}
    </div>
  );
}
```

`features/web-analytics/components/trend-chart.tsx`:

```tsx
"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useWaOverview, type WaQuery } from "../api/use-web-analytics";
import { bucketLabel, METRIC_LABELS, pointValue, type Metric } from "../lib/format";

const IS_RATE: ReadonlySet<Metric> = new Set<Metric>(["bounceRate", "conversionRate"]);

export function TrendChart({ q, metric }: { q: WaQuery; metric: Metric }) {
  const { data, isLoading } = useWaOverview(q);
  const config = { value: { label: METRIC_LABELS[metric], color: "var(--chart-1)" } } satisfies ChartConfig;
  const points = (data?.series ?? []).map((point) => {
    const value = pointValue(point, metric);
    // Rates are charted as percentages, one decimal.
    return { label: bucketLabel(point.bucket, data!.unit), value: IS_RATE.has(metric) ? Math.round(value * 1000) / 10 : value };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {METRIC_LABELS[metric]}
          {IS_RATE.has(metric) ? " (%)" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ChartContainer config={config} className="h-64 w-full">
            <AreaChart data={points} margin={{ left: 4, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="value"
                type="monotone"
                fill="var(--color-value)"
                fillOpacity={0.15}
                stroke="var(--color-value)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: The dashboard container and the page tabs**

`features/web-analytics/components/web-analytics-dashboard.tsx`:

```tsx
"use client";

import React from "react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { parseAsString, parseAsStringEnum, useQueryState, useQueryStates } from "nuqs";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { WaQuery } from "../api/use-web-analytics";
import { DIMENSION_KEYS, type Dimension, type Filters } from "../lib/dimensions";
import { METRICS, RANGE_PRESETS, presetRange, type Metric, type RangePreset } from "../lib/format";
import { FilterChips } from "./filter-chips";
import { KpiCards } from "./kpi-cards";
import { LiveBadge } from "./live-badge";
import { TrackingOffBanner, TrackingToggle } from "./tracking-toggle";
import { TrendChart } from "./trend-chart";

const filterParsers = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, parseAsString])) as Record<
  Dimension,
  typeof parseAsString
>;

export function WebAnalyticsDashboard() {
  const [preset, setPreset] = useQueryState(
    "range",
    parseAsStringEnum<RangePreset>(["today", "7d", "30d", "90d", "custom"]).withDefault("7d"),
  );
  const [fromStr, setFromStr] = useQueryState("from", parseAsString.withDefault(""));
  const [toStr, setToStr] = useQueryState("to", parseAsString.withDefault(""));
  const [metric, setMetric] = useQueryState("metric", parseAsStringEnum<Metric>([...METRICS]).withDefault("visitors"));
  const [filterValues, setFilterValues] = useQueryStates(filterParsers);

  const filters = React.useMemo<Filters>(() => {
    const out: Filters = {};
    for (const key of DIMENSION_KEYS) {
      const value = filterValues[key];
      if (value) out[key] = value;
    }
    return out;
  }, [filterValues]);

  const range = React.useMemo(() => {
    if (preset === "custom" && fromStr) {
      const from = parseISO(fromStr);
      const to = toStr ? parseISO(toStr) : from;
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        return { from: startOfDay(from).toISOString(), to: endOfDay(to).toISOString() };
      }
    }
    return presetRange(preset === "custom" ? "7d" : preset, new Date());
  }, [preset, fromStr, toStr]);

  const q: WaQuery = { from: range.from, to: range.to, filters };

  const customValue: DateRange | undefined =
    preset === "custom" && fromStr ? { from: parseISO(fromStr), to: toStr ? parseISO(toStr) : undefined } : undefined;

  const choosePreset = (value: Exclude<RangePreset, "custom">) => {
    void setPreset(value);
    void setFromStr(null);
    void setToStr(null);
  };

  const chooseCustom = (value: DateRange | undefined) => {
    if (!value?.from) return choosePreset("7d");
    void setPreset("custom");
    void setFromStr(format(value.from, "yyyy-MM-dd"));
    void setToStr(value.to ? format(value.to, "yyyy-MM-dd") : null);
  };

  // A computed key widens to an index signature; the cast restores the
  // per-dimension shape useQueryStates expects.
  type FilterPatch = Partial<Record<Dimension, string | null>>;
  // Used by the breakdown panels (Task 11).
  const addFilter = (dim: Dimension, value: string) => void setFilterValues({ [dim]: value } as FilterPatch);
  const removeFilter = (dim: Dimension) => void setFilterValues({ [dim]: null } as FilterPatch);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_PRESETS.map((p) => (
          <Button key={p.value} size="sm" variant={preset === p.value ? "default" : "outline"} onClick={() => choosePreset(p.value)}>
            {p.label}
          </Button>
        ))}
        <DateRangePicker value={customValue} onChange={chooseCustom} />
        <div className="ml-auto flex items-center gap-3">
          <LiveBadge />
          <TrackingToggle />
        </div>
      </div>
      <TrackingOffBanner />
      <FilterChips filters={filters} onRemove={removeFilter} />
      <KpiCards q={q} metric={metric} onSelect={(m) => void setMetric(m)} />
      <TrendChart q={q} metric={metric} />
    </div>
  );
}
```

`addFilter` is not used until Task 11. If ESLint flags it as unused, prefix it with `_` (`_addFilter`) in this task, and rename it back to `addFilter` in Task 11.

`app/(dashboard)/dashboard/analytics/analytics-tabs.tsx`:

```tsx
"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WebAnalyticsDashboard } from "@/features/web-analytics/components/web-analytics-dashboard";
import AnalyticsClient from "./analytics-client";

export default function AnalyticsTabs() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Tabs defaultValue="website">
        <TabsList>
          <TabsTrigger value="website">Website</TabsTrigger>
          <TabsTrigger value="ga4">GA4</TabsTrigger>
        </TabsList>
        <TabsContent value="website" className="mt-4">
          {/* nuqs reads the URL (useSearchParams), which needs a Suspense boundary. */}
          <React.Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
            <WebAnalyticsDashboard />
          </React.Suspense>
        </TabsContent>
        <TabsContent value="ga4" className="mt-4">
          <AnalyticsClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

Replace `app/(dashboard)/dashboard/analytics/page.tsx` with:

```tsx
import type { Metadata } from "next";
import AnalyticsTabs from "./analytics-tabs";

export const metadata: Metadata = {
  title: "Analytics | Sleep Sheet Admin",
  description: "Website visitors, sources, funnel and orders, plus Google Analytics 4 links",
};

export default function AnalyticsPage() {
  return <AnalyticsTabs />;
}
```

- [ ] **Step 7: Type-check, lint, look at it**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint features/web-analytics "app/(dashboard)/dashboard/analytics"`
Expected: no errors.

Ask the owner to open `http://localhost:3001/dashboard/analytics` while logged in as an admin. They should see a "Website" tab with range buttons, "N online", the Tracking switch, six KPI cards (zeros are fine on a fresh local DB) and an area chart. The "GA4" tab should show the old page unchanged.

- [ ] **Step 8: Commit**

```bash
git add features/web-analytics "app/(dashboard)/dashboard/analytics"
git commit -m "feat(web-analytics): dashboard shell with KPIs, trend chart, live and tracking switch"
```

---

### Task 11: Breakdown panels, funnel, products

**Files:**
- Create: `features/web-analytics/components/breakdown-panel.tsx`
- Create: `features/web-analytics/components/funnel-card.tsx`
- Create: `features/web-analytics/components/products-table.tsx`
- Modify: `features/web-analytics/components/web-analytics-dashboard.tsx`

**Interfaces:**
- Consumes: `useWaBreakdown`, `useWaFunnel`, `useWaProducts` (Task 9); `keyLabel`, `formatCount`, `formatPercent` (Task 10); `NONE`, `Dimension` (Task 7); `Funnel` (Task 7).
- Produces: `<BreakdownPanel q tabs showOrders onSelect />`, `<FunnelCard q />`, `<ProductsTable q />`.

- [ ] **Step 1: Breakdown panel**

`features/web-analytics/components/breakdown-panel.tsx`:

```tsx
"use client";

import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/use-currency";
import { useWaBreakdown, type WaQuery } from "../api/use-web-analytics";
import { NONE, type Dimension } from "../lib/dimensions";
import { formatCount, keyLabel } from "../lib/format";

export interface BreakdownTab {
  dim: Dimension;
  label: string;
}

export function BreakdownPanel({
  q,
  tabs,
  showOrders = false,
  onSelect,
}: {
  q: WaQuery;
  tabs: BreakdownTab[];
  showOrders?: boolean;
  onSelect: (dim: Dimension, value: string) => void;
}) {
  const [active, setActive] = React.useState<Dimension>(tabs[0].dim);
  const { data, isLoading } = useWaBreakdown(q, active);
  const { formatAmount } = useCurrency();
  const rows = data?.rows ?? [];
  const max = Math.max(1, ...rows.map((row) => row.visitors));
  const activeLabel = tabs.find((tab) => tab.dim === active)?.label ?? "";

  return (
    <Card>
      <CardHeader className="pb-2">
        {tabs.length > 1 ? (
          <Tabs value={active} onValueChange={(value) => setActive(value as Dimension)}>
            <TabsList>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.dim} value={tab.dim}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <span className="text-sm font-medium">{activeLabel}</span>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex justify-between px-3 text-xs uppercase text-muted-foreground">
          <span>{activeLabel}</span>
          <span className="flex gap-6">
            {showOrders && (
              <>
                <span className="w-10 text-right">Orders</span>
                <span className="w-20 text-right">Revenue</span>
              </>
            )}
            <span className="w-12 text-right">Visitors</span>
          </span>
        </div>
        {isLoading && !data ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No data for this range.</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.key ?? NONE}>
                <button
                  type="button"
                  onClick={() => onSelect(active, row.key ?? NONE)}
                  className="relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-md px-3 py-2 text-left text-sm hover:bg-muted/60"
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-primary/10"
                    style={{ width: `${(row.visitors / max) * 100}%` }}
                    aria-hidden="true"
                  />
                  <span className="relative truncate">{keyLabel(active, row.key)}</span>
                  <span className="relative flex shrink-0 gap-6 tabular-nums">
                    {showOrders && (
                      <>
                        <span className="w-10 text-right">{formatCount(row.orders)}</span>
                        <span className="w-20 text-right">{formatAmount(row.revenue)}</span>
                      </>
                    )}
                    <span className="w-12 text-right font-medium">{formatCount(row.visitors)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Funnel and products**

`features/web-analytics/components/funnel-card.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWaFunnel, type WaQuery } from "../api/use-web-analytics";
import { formatCount, formatPercent } from "../lib/format";
import type { Funnel } from "../lib/types";

const STEPS: { key: keyof Funnel; label: string }[] = [
  { key: "visited", label: "Visited" },
  { key: "viewedProduct", label: "Viewed a product" },
  { key: "addedToCart", label: "Added to cart / Buy now" },
  { key: "startedCheckout", label: "Started checkout" },
  { key: "ordered", label: "Placed an order" },
];

export function FunnelCard({ q }: { q: WaQuery }) {
  const { data, isLoading } = useWaFunnel(q);
  const top = data?.visited ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conversion funnel</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ol className="space-y-3">
            {STEPS.map((step, i) => {
              const value = data?.[step.key] ?? 0;
              const prev = i === 0 ? value : (data?.[STEPS[i - 1].key] ?? 0);
              return (
                <li key={step.key}>
                  <div className="mb-1 flex flex-wrap justify-between gap-x-2 text-sm">
                    <span>{step.label}</span>
                    <span className="tabular-nums">
                      <span className="font-medium">{formatCount(value)}</span>
                      {i > 0 && (
                        <span className="ml-2 text-muted-foreground">
                          {formatPercent(prev ? value / prev : 0)} of previous · {formatCount(Math.max(0, prev - value))} dropped
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${top ? (value / top) * 100 : 0}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
```

`features/web-analytics/components/products-table.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWaProducts, type WaQuery } from "../api/use-web-analytics";
import { formatCount, formatPercent } from "../lib/format";

export function ProductsTable({ q }: { q: WaQuery }) {
  const { data, isLoading } = useWaProducts(q);
  const rows = data?.rows ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Products</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <Skeleton className="h-56 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No product views in this range.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Add to cart</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">View→Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.productId}>
                  <TableCell className="max-w-56 truncate">{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.views)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.addedToCart)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.orders)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(row.views ? row.orders / row.views : 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Put them on the dashboard**

In `web-analytics-dashboard.tsx`:

1. Add imports:

```tsx
import { BreakdownPanel } from "./breakdown-panel";
import { FunnelCard } from "./funnel-card";
import { ProductsTable } from "./products-table";
```

2. If Task 10 renamed it to `_addFilter`, rename it back to `addFilter` and drop the "Used by the breakdown panels" comment.
3. After `<TrendChart q={q} metric={metric} />`, add:

```tsx
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownPanel
          q={q}
          tabs={[
            { dim: "path", label: "Pages" },
            { dim: "route", label: "Routes" },
            { dim: "hostname", label: "Hostnames" },
          ]}
          onSelect={addFilter}
        />
        <BreakdownPanel
          q={q}
          tabs={[
            { dim: "referrer", label: "Referrers" },
            { dim: "utmSource", label: "UTM Source" },
            { dim: "utmMedium", label: "Medium" },
            { dim: "utmCampaign", label: "Campaign" },
          ]}
          showOrders
          onSelect={addFilter}
        />
        <BreakdownPanel q={q} tabs={[{ dim: "country", label: "Countries" }]} onSelect={addFilter} />
        <BreakdownPanel
          q={q}
          tabs={[
            { dim: "device", label: "Devices" },
            { dim: "browser", label: "Browsers" },
            { dim: "os", label: "OS" },
          ]}
          onSelect={addFilter}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelCard q={q} />
        <ProductsTable q={q} />
      </div>
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint features/web-analytics "app/(dashboard)/dashboard/analytics"`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add features/web-analytics/components
git commit -m "feat(web-analytics): breakdown panels, funnel and products table"
```

---

### Task 12: End-to-end verification and rollout

**Files:** none new. This task verifies, then ships.

**Interfaces:**
- Consumes: everything above.
- Produces: a verified feature on `main`; migration `0031` applied to production; deploy.

- [ ] **Step 1: Full test suite, types, lint**

```bash
pnpm vitest run
set -a && source .env && set +a && RUN_DB_TESTS=1 pnpm vitest run features/web-analytics/server/queries.db.test.ts
npx tsc --noEmit -p .
npx eslint features/web-analytics lib/traffic-tracker.ts components/traffic-tracker.tsx lib/analytics-access.ts features/checkout "app/(dashboard)/dashboard/analytics"
git diff HEAD~11 -- package.json   # 11 = one commit per Task 1–11
```

Expected: all tests pass; 0 type errors; 0 lint errors; the `package.json` diff is empty (no new dependencies). If other commits landed on `main` in between, diff against the commit before Task 1 instead.

- [ ] **Step 2: Browse like a visitor and check the rows**

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
agent-browser close >/dev/null 2>&1
agent-browser --user-agent "$UA" open "http://localhost:3001/?utm_source=e2e&utm_campaign=rollout"
agent-browser wait 4000
agent-browser eval "location.href = '/shop'"
agent-browser wait 4000
agent-browser eval "location.href = document.querySelector('a[href^=\"/shop/\"]').getAttribute('href')"
agent-browser wait 5000
agent-browser eval "JSON.parse(localStorage.getItem('ss_session')).id"
agent-browser close
```

With the printed session id `<sid>`:

```bash
set -a && source .env && set +a
psql "$DATABASE_URL" -c "select type, path, route, utm_source, utm_campaign, device from analytics_events where session_id = '<sid>' order by ts"
```

Expected rows: `page_view /`, `page_view /shop`, `page_view /shop/<slug>` (route `/shop/[slug]`), `product_view /shop/<slug>`, all `utm_source = e2e`, `utm_campaign = rollout`, `Desktop`.

- [ ] **Step 3: The off switch**

```bash
psql "$DATABASE_URL" -c "insert into site_settings (key, value) values ('analytics_enabled', 'false') on conflict (key) do update set value = 'false', \"updatedAt\" = now()"
sleep 65   # the in-process settings cache lives 60 s; the admin switch invalidates it instantly, a direct SQL write does not
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/t -H 'origin: http://localhost:3001' -H 'content-type: application/json' -H "user-agent: $UA" \
  -d '{"type":"page_view","path":"/off-check","visitorId":"off-v","sessionId":"off-s"}'
psql "$DATABASE_URL" -tAc "select count(*) from analytics_events where visitor_id = 'off-v'"
psql "$DATABASE_URL" -c "delete from site_settings where key = 'analytics_enabled'"
```

Expected: `204`, then `0`, then `DELETE 1` (tracking back on).

- [ ] **Step 4: Owner checks the dashboard**

Ask the owner to open `/dashboard/analytics` (logged in), choose "Today", and confirm:

- visitors and page views include the e2e visit;
- the UTM Campaign tab lists `rollout`, and clicking it adds a chip that filters every panel;
- Products lists the product that was viewed;
- the Tracking switch flips Off and On and the banner shows while it's off;
- the GA4 tab still works;
- the page is usable at phone width.

Then clean up the local test rows: `psql "$DATABASE_URL" -c "delete from analytics_events where utm_source = 'e2e'"`.

- [ ] **Step 5: Apply 0031 to production (owner confirms first)**

Ask the owner how to reach the production database. Production is Dokploy on the Mumbai VPS with Postgres not exposed publicly (see `deploy/README.md` and the `neon-to-vps-postgres` project notes). Typically that means SSH to the VPS and running psql inside the Postgres container:

```bash
# on the VPS, after the owner confirms the container and database names
docker exec -i <postgres-container> psql -U <user> -d <database> -tAc "select to_regclass('public.analytics_events')"
docker exec -i <postgres-container> psql -U <user> -d <database> -v ON_ERROR_STOP=1 < 0031_<name>.sql
docker exec -i <postgres-container> psql -U <user> -d <database> -c '\d analytics_events'
```

Expected: the first command prints an empty line (the table doesn't exist yet); then the table and 4 indexes.

- [ ] **Step 6: Ship**

With the owner's go-ahead: `git push origin main`. GitHub Actions builds the image and Dokploy deploys it.

After the deploy, from the VPS:

```bash
docker exec -i <postgres-container> psql -U <user> -d <database> -c "select count(*), max(ts) from analytics_events"
```

Expected: the count grows within minutes from real traffic. A day later, compare visitors and page views with GA4. Ours should be equal or higher, because GA4 misses visitors who never interact before GTM loads.
