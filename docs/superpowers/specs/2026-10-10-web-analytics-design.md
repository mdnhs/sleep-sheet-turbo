# First-party web analytics — design

Date: 2026-10-10
Status: approved in conversation, awaiting written-spec review

## Goal

A Vercel-Analytics-style dashboard inside the admin panel, built on the store's
own Postgres, that answers four questions:

1. **Marketing**: which referrers, UTM sources/mediums/campaigns and ad clicks
   bring visitors, and which of them turn into orders and revenue.
2. **Daily overview**: visitors, page views, bounce rate, a trend chart, top
   pages.
3. **Conversion funnel**: visit → product view → add to cart / buy now →
   checkout → order, and where people drop off.
4. **Live**: how many people are on the site right now, and on which pages.

Production moved off Vercel to a single Dokploy VPS (Mumbai) behind
Cloudflare, so Vercel Analytics is no longer available. The database is now
self-hosted Postgres, which removes the reason first-party tracking was dropped
before (every write kept serverless Neon compute awake; see
`lib/traffic-tracker.ts:15-19` and `db/migrations/0013_drop_traffic_events.sql`).

An admin can switch tracking on and off at any time from the dashboard.

## Non-goals (this iteration)

- Time on page, scroll depth, heatmaps, session replay.
- Rollup/aggregate tables (raw events are enough at current volume).
- CSV export.
- MCP tools for the new data (the stale `get_traffic_summary` in
  `mcp-server/dist` stays as is for now).
- Replacing GA4/GTM. They keep running unchanged alongside this.

## Current state (what exists today)

- `components/traffic-tracker.tsx` fires `trackEvent("page_view", pathname)` on
  every route change; `lib/traffic-tracker.ts` sends events to `gtag` only.
- Event call sites: `product_view` (`features/product/components/product-view-tracker.tsx`),
  `add_to_cart` / `buy_now` (`components/product/product-card.tsx`,
  `features/product/components/product-picker.tsx`), `order_complete`
  (`app/(client)/order-success/page.tsx`). `checkout_start` is declared but
  never fired.
- GTM loads only after the first interaction, so GA4 misses visitors who never
  touch the page.
- Reusable pieces: `lib/visitor-id.ts` (`ss_visitor_id` in localStorage),
  `lib/user-agent-parser.ts`, `lib/rate-limit.ts`, `lib/settings-cache.ts`,
  `lib/date-utils.ts`, `lib/data-retention.ts`, `canViewAnalytics` and the
  trend/zero-fill patterns in `features/analytics/server/route.ts`, recharts +
  `components/ui/chart.tsx`.
- `/dashboard/analytics` is static: GA4 deep links, copy, and a Looker Studio
  iframe (`app/(dashboard)/dashboard/analytics/analytics-client.tsx`).

## Architecture

```
storefront (browser)                       server (Hono, /api)                 Postgres
─────────────────────                      ───────────────────                 ────────
trackEvent(type, path, …) ──► gtag (GA4, unchanged)
            │
            └─► sendBeacon POST /api/t ──► collect route ── validate, bot filter,
                                                    UA parse, cf-ipcountry,
                                                    enabled? ──────────────────► analytics_events
checkout POST /api/checkout ──► create order ──► recordOrderEvent (server-side) ─► analytics_events
                                                                                    orders (join)
/dashboard/analytics ──► GET /api/web-analytics/{overview,breakdown,funnel,
                         products,live} ── canViewAnalytics ── SQL ───────────────► analytics_events
```

New code lives in `features/web-analytics/`:

| Unit | Purpose |
|---|---|
| `lib/collector.ts` (client) | Session handling, payload building, `sendBeacon`. No React, no deps. |
| `lib/session.ts` (client) | 30-minute session rule and session landing attributes. |
| `lib/route-pattern.ts` (shared) | `toRoute(path)`: `/shop/abc` → `/shop/[slug]`. |
| `lib/bot.ts` (server) | User-agent bot detection. |
| `server/collect.ts` | `POST /api/t` ingestion route. |
| `server/record-order-event.ts` | Server-side `order_complete` insert used by checkout. |
| `server/queries.ts` | All aggregation SQL, one function per metric group. |
| `server/route.ts` | `GET /api/web-analytics/*` dashboard endpoints. |
| `api/use-web-analytics.ts` | React Query hooks. |
| `components/*` | Dashboard UI pieces. |

## 1. Collection (client)

`lib/traffic-tracker.ts`'s `trackEvent` keeps its gtag call and additionally
calls the collector inside the same `afterNextPaint` callback, so the beacon
never runs inside an input handler (INP) and never blocks paint (LCP).

**Events sent first-party:** `page_view`, `product_view`, `add_to_cart`,
`buy_now`, `checkout_start`. `order_complete` is **not** sent from the client
(the server records it, see §5); the order-success page keeps sending it to
GA4 only. `checkout_start` is newly fired once per page load when the checkout
page (`app/(client)/checkout/checkout-client.tsx`) mounts with a non-empty cart.
It calls the collector directly rather than `trackEvent`, so GA4 does not get a
new custom event (GTM already sends `begin_checkout`).

**Skipped:** anything on `/dashboard`, same as today.

**Identity:**

- Visitor: existing `getVisitorId()` (`ss_visitor_id`, random UUID in
  localStorage).
- Session: `ss_session` in localStorage, `{ id, lastSeen, landing }`. A new
  session starts when there is none, when `lastSeen` is more than 30 minutes
  ago, or when the current URL carries `utm_*`, `gclid` or `fbclid` (a new
  campaign click). `lastSeen` is bumped on every event. If storage is blocked,
  ids live in memory for the page's lifetime.

**Session landing attributes** (computed when a session starts, attached to
every event of that session):

- `referrerHost`: hostname of `document.referrer`, or null when empty or one
  of the site's own hosts.
- `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent` from the
  landing URL.
- `adClick`: `"google"` if `gclid` present, `"facebook"` if `fbclid` present,
  else null.

**Payload** (JSON, `application/json` Blob via `navigator.sendBeacon`, falling
back to `fetch(..., { keepalive: true })`):

```json
{
  "type": "page_view",
  "path": "/shop/premium-comforter",
  "hostname": "sleepsheetbd.com",
  "visitorId": "…",
  "sessionId": "…",
  "referrerHost": "youtube.com",
  "utmSource": "youtube", "utmMedium": "cpc", "utmCampaign": "oct",
  "utmTerm": null, "utmContent": null,
  "adClick": null,
  "label": "Premium Comforter",
  "productId": "…",
  "value": 2450
}
```

`path` is the pathname only (no query string, no hash).

**Enabled flag on the client:** the collector sends by default and stops once
the public settings say `analytics_enabled === "false"`. `TrafficTracker`
reads `useWebsiteSettings()` and calls `setCollectorEnabled(bool)`. Defaulting
to "send" means the landing page view isn't lost while settings load; the
server is the authority and drops events when tracking is off.

## 2. Ingestion — `POST /api/t`

Mounted in `app/api/[[...route]]/route.ts` as `.route("/t", collect)`. The
short path avoids ad-blocker lists that match "analytics"/"collect"/"track".
No `sessionMiddleware`. Cloudflare already bypasses cache for `/api/`.

Steps, in order. Every rejection after step 1 answers `204`; the rate
limiter's own `429` is fine too, since beacons ignore the response and never
retry:

1. Rate limit: `rateLimit("collect", 120, 60_000)` per client IP.
2. Same-origin only: the host of the `Origin` header (or `Referer` when a
   browser omits `Origin`) must equal the request's `Host`. This works on the
   dev port and in production alike, unlike the `NEXT_PUBLIC_APP_URL`-based
   `trustedOrigins` list.
3. Body ≤ 2 KB; parsed and validated with zod: `type` in the enum above,
   strings trimmed and length-capped (path/label 300, ids 64, utm 150, host
   100), `value` finite and ≥ 0.
4. Drop when `path` starts with `/dashboard`.
5. Drop bots: empty UA, or UA matching `lib/bot.ts` (bot, crawl, spider,
   slurp, headless, lighthouse, pagespeed, facebookexternalhit, preview,
   monitoring, curl, wget, python, …).
6. Drop when `getSetting("analytics_enabled")` is `"false"` (in-process cache,
   invalidated by the settings PATCH).
7. Derive `browser`, `os`, `device` with `parseUserAgent`, `country` from
   `cf-ipcountry` (null for missing, `XX`, `T1`), `route` with `toRoute`.
8. Insert one row. Errors are logged and swallowed.
9. Call `sweepRetention("analytics")` (fire-and-forget, hourly per instance).

The client IP is used only for the in-memory rate limiter and is never stored.

`logActivity` (applied to `*`) must not record these requests: confirm it
skips requests without a session user, and add an explicit `/api/t` skip if it
doesn't.

## 3. On/off toggle

- New settings key `analytics_enabled` (`"true"` / `"false"`), added to the
  settings PATCH zod schema in `features/settings/server/route.ts` as
  `z.enum(["true", "false"]).optional()`. Missing key means **on**.
- Switch in the analytics dashboard header ("Tracking: On / Off"). It is
  enabled only for users with `can(user, "settings", "write")`, the same check
  the PATCH already does. It saves through the existing PATCH, which already
  calls `invalidateSettingsCache()` and `revalidateTag("settings")`.
- Effect of **off**: `/api/t` and `recordOrderEvent` stop writing immediately.
  New page loads stop sending beacons; already-open tabs may send for up to the
  public settings cache window (~5 minutes), and those are dropped by the
  server. GA4 is unaffected.
- While off, the dashboard keeps showing stored data with a "Tracking is off"
  banner.

## 4. Storage

### Table `analytics_events`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint generated always as identity` PK | high-volume table, small index |
| `ts` | `timestamptz not null default now()` | |
| `type` | `text not null` | `page_view`, `product_view`, `add_to_cart`, `buy_now`, `checkout_start`, `order_complete` |
| `visitor_id` | `text not null` | |
| `session_id` | `text not null` | server order events without a client session use `srv-<orderId>` |
| `path` | `text not null` | pathname |
| `route` | `text not null` | `toRoute(path)` |
| `hostname` | `text` | |
| `referrer_host` | `text` | session landing |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | `text` | session landing |
| `ad_click` | `text` | `google` / `facebook` |
| `country` | `text` | ISO-3166 alpha-2 |
| `device` | `text` | Desktop / Mobile / Tablet |
| `browser` | `text` | e.g. "Chrome 141" |
| `os` | `text` | |
| `label` | `text` | |
| `product_id` | `text` | |
| `value` | `numeric(12,2)` | |
| `order_id` | `text` | `order_complete` only |

Indexes: `(ts)`, `(type, ts)`, `(session_id)`, `(order_id) where order_id is not null`.

`toRoute` patterns, from the storefront's dynamic segments:
`/shop/[slug]`, `/blog/[slug]`, `/categories/[value]`, `/videos/share/[slug]`,
`/orders/[orderId]`. Everything else maps to itself.

### Retention

Raw events are kept 12 months. `lib/data-retention.ts`: the `sweepRetention`
`kind` union gains `"analytics"`, deleting `ts < now() - 365 days`, triggered
from the collect route. Expected volume is roughly 150–200k rows/month (~2M at
steady state).

### Migration

Hand-written `db/migrations/0031_analytics_events.sql` using
`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, plus the matching
`pgTable` in `db/schema.ts`. Applied with `psql` (never `drizzle-kit migrate`,
see `db/migrations/README.md`), local Docker DB first, production only after
the owner confirms. `pnpm db:generate` output is diffed against what is live
before committing.

## 5. Order attribution

- The checkout request schema (`features/checkout/server/route.ts`) gains
  optional `analyticsVisitorId` and `analyticsSessionId`; the checkout client
  sends them from the collector.
- After an order is created (both creation paths in that route), the route
  calls `recordOrderEvent({ orderId, value: totalAmount, visitorId, sessionId,
  request })` without awaiting it. Errors are swallowed.
- `recordOrderEvent` does nothing when tracking is off. Otherwise it reads the
  session's most recent event (indexed on `session_id`) and copies its landing
  attributes, path, route and hostname. With no session match it falls back to
  the request's UA, `cf-ipcountry` and path `/checkout`; with no session id at
  all (an old client) it uses `srv-<orderId>` as both session and visitor id.
  Then it inserts a `type = 'order_complete'` row with `order_id` and `value`.
- bKash orders are recorded at creation like the rest. A bKash payment that
  never completes ends up cancelled, and the `orders` join below drops it.
- **Revenue and order counts always join `orders`** on `order_id`, excluding
  `CANCELLED` and `REFUNDED`, with revenue = `totalAmount - COALESCE(refundedAmount, 0)`
  (the same rule as `/analytics/sales-overview`). A later cancel or refund
  therefore drops out of the dashboard automatically.
- POS and admin-created orders have no event and are intentionally excluded:
  the KPI is labelled **Website orders**.

## 6. Metric definitions

All metrics are for a `[start, end]` range plus optional filters.

| Metric | Definition |
|---|---|
| Visitors | distinct `visitor_id` among matching `page_view` rows |
| Page views | count of matching `page_view` rows |
| Sessions | distinct `session_id` among matching rows |
| Bounce rate | sessions with exactly one `page_view` ÷ sessions (over sessions with ≥ 1 matching page view) |
| Website orders | valid orders whose `order_complete` event belongs to a qualifying session |
| Revenue | sum over those orders as defined in §5 |
| Conversion rate | website orders ÷ visitors |
| Online now | distinct `visitor_id` with any event in the last 5 minutes |
| Trend % | same metric over the previous equal-length range (`getPreviousRange`) |

**Filters**: `path`, `route`, `hostname`, `referrer`, `utmSource`,
`utmMedium`, `utmCampaign`, `country`, `device`, `browser`, `os`. They are
`WHERE` conditions on events. Landing attributes are stored on every event, so
a referrer/UTM/country/device filter naturally selects whole sessions. A
**qualifying session** is one with at least one event matching every filter;
order metrics and the funnel count qualifying sessions.

**Buckets**: hourly when the range is two days or less, daily up to 92 days,
monthly beyond (`features/web-analytics/lib/buckets.ts`); zero filled;
truncated in `Asia/Dhaka` time so "today" and day boundaries match the store's
clock.

## 7. Dashboard (`/dashboard/analytics`)

Page tabs: **Website** (new, default) and **GA4** (the existing
`analytics-client.tsx` content, moved unchanged).

Header:

- Date range: Today, Last 7 days, Last 30 days, Last 90 days, Custom. URL state
  via `nuqs`, same pattern and `components/ui/date-range-picker` as
  `/dashboard/reports`.
- "● N online": `GET /web-analytics/live`, polled every 30 s while the tab is
  visible. Clicking it opens a popover listing the current pages.
- Tracking On/Off switch (§3).
- Active filter chips, each removable; all filters live in the URL.

Body:

1. KPI cards: Visitors, Page views, Bounce rate, Website orders, Revenue,
   Conversion rate, each with a trend %. Selecting a card switches the chart.
2. Area chart of the selected metric over time.
3. Panels with tabs; every row shows visitors plus a bar, and clicking a row
   adds it as a filter:
   - Pages | Routes | Hostnames
   - Referrers | UTM Source | UTM Medium | UTM Campaign (these rows also show
     website orders and revenue)
   - Countries
   - Devices | Browsers | OS
4. Funnel: Visit → Product view → Add to cart / Buy now → Checkout → Order. For
   each step it shows qualifying sessions with the step's event, % of the
   previous step, and drop-off. Steps are not order-enforced.
5. Products table: product, views (sessions with `product_view`), add to cart
   (sessions with `add_to_cart` or `buy_now`), orders (from `order_items`
   joined to valid website orders), view→order %.

Layout stacks to one column on mobile.

Endpoints (`features/web-analytics/server/route.ts`, all gated by
`canViewAnalytics`, which moves from `features/analytics/server/route.ts` to
`lib/analytics-access.ts` so both routes share it; all taking `from`/`to` +
filters):

- `GET /overview`: KPIs, previous-period KPIs, series.
- `GET /breakdown?dim=<dimension>&limit=10`
- `GET /funnel`
- `GET /products?limit=20`
- `GET /live`: online count and current paths (no range).

## 8. Security and privacy

- No IP addresses and no personal data are stored; visitor and session ids are
  random. Clearing site data makes a visitor "new".
- Ingestion is rate limited, origin-checked, size-capped and schema-validated
  (§2). It answers `204` (or `429` when rate limited) and never echoes input.
- Dashboard endpoints use the existing `canViewAnalytics` gate; the toggle
  uses `settings:write`.
- All SQL uses bound parameters; `dim` is mapped through a fixed allow-list to
  column names, never interpolated.

## 9. Testing

Vitest (already in the repo).

- Unit: `lib/bot.ts`, the session rule (new session after 30 minutes or on a
  campaign URL), referrer-host extraction including own-host stripping, UTM
  parsing, `toRoute`, the collect payload schema.
- Integration against the local Docker Postgres (`docker-compose.db.yml`,
  `:5433`) with seeded events and orders: visitors, page views, bounce rate,
  conversion rate, trend %, a filter, funnel steps; a cancelled order excluded
  from revenue; nothing written while `analytics_enabled = "false"`.
- Browser (headless agent-browser on the dev server): browse a few pages and
  place a test order, then confirm the rows and the dashboard numbers; switch
  tracking off and confirm no new rows; confirm the beacon doesn't add long
  tasks and the collector adds no dependencies.

## 10. Rollout

1. Apply `0031` to the local DB; run the tests.
2. Apply `0031` to the production database, **after the owner confirms**, and
   before the code ships. The collector and `recordOrderEvent` swallow errors,
   so a missing table can never break pages or checkout.
3. Push to `main` → GitHub Actions → Dokploy deploy.
4. Tracking defaults to on. On day one, compare visitors and page views with
   GA4 as a sanity check. Ours should be equal or higher, because GA4 misses
   visitors who never interact before GTM loads.

## Deferred

MCP tools for the new data, CSV export, rollups, time on page.
