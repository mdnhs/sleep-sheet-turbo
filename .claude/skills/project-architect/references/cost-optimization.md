# Cost Optimization (read this first)

**Priority #1 for this project: minimize Vercel spend and Neon compute hours.** Every other
concern — elegance, abstraction, feature richness — yields to this when they conflict.

Two meters are running:

| Meter                    | Charged for                                                     | How to reduce                                        |
| ------------------------ | --------------------------------------------------------------- | ---------------------------------------------------- |
| **Vercel Function**      | Invocations × active CPU + provisioned memory × wall-clock time  | Fewer invocations; less time awake per invocation     |
| **Neon compute hours**   | Wall-clock time the compute endpoint is **awake**, per CU        | Fewer awake-minutes; smaller CU; never poll           |

The critical, non-obvious rule:

> **Neon bills for time awake, not for queries.** One query per minute costs the same as a
> thousand — the endpoint simply never scales to zero. Cost is driven by *how often* the database
> is touched, not *how much* is asked each time. Batch aggressively; never poll.

---

## The rule of the two zeros

1. **Zero function invocations** for anything a CDN can serve.
2. **Zero database wake-ups** for anything a cache can answer.

Every design decision gets checked against these before it is written.

---

## Neon: reducing compute hours

### Autosuspend

Set the endpoint's **suspend timeout to the minimum** (5 minutes on the free/launch plans; 60s where
available). Verify in the Neon console → Branch → Compute → *Suspend compute after a period of
inactivity*.

Compute size: start at **0.25 CU** min and cap autoscaling at 1–2 CU. Raise only on evidence from
`list_slow_queries`. An oversized minimum bills the full CU for every awake second.

### What keeps the database awake (kill all of these)

- ❌ **Any polling loop** — `refetchInterval`, `revalidate: 10`, a cron pinging a DB-backed
  endpoint, an uptime monitor hitting a route that queries. A 60-second health check that touches
  Postgres = **720 compute hours/month**, i.e. always-on billing for an idle app.
- ❌ **Health checks that query.** `/api/health` returns a static object. It must never `SELECT 1`.
- ❌ **A pooled/WebSocket driver held open.** `drizzle-orm/neon-serverless` (`Pool`) keeps a live
  connection; the endpoint cannot suspend while it exists. Default to `neon-http`, which is a
  stateless HTTP request — the endpoint suspends the moment the query returns.
- ❌ **`proxy.ts` (Next.js 16's middleware) reading the database** — it runs on nearly every
  request, including asset requests, and re-wakes the endpoint constantly.
- ❌ **Per-request auth lookups.** Verifying a session by fetching the user row on every request
  turns every page view into a wake-up. Put the user id, role, and permission bits inside a signed
  JWT/session cookie and read the DB only on login and on permission change.
- ❌ **Analytics/logging writes on every request.** Batch them, or drop them.

### What reduces awake-time

- ✅ **Cache reads.** A tagged `'use cache'` hit does not wake the endpoint at all.
- ✅ **Batch every query in a request into one round trip.** `Promise.all` / `db.batch` means one
  wake-up window instead of a serial chain that holds the endpoint up for the sum of all latencies.
- ✅ **Long `cacheLife` profiles + tag invalidation on write.** Writes are rare; reads are not.
  `cacheLife('hours')` on reference data is worth more than any query tuning.
- ✅ **Make writes coalesce.** Prefer one bulk `insert().values([...])` to N inserts in a loop.
- ✅ **Run migrations and heavy admin jobs together**, not scattered through the day.
- ✅ **Preview branches**: Neon branches bill their own compute. Delete stale preview branches, or
  set them to suspend at the minimum.

### Avoid the second query per list request

`COUNT(*)` over a large filtered table is often more expensive than the page itself. Options, best
first:

1. **Cursor pagination** (`WHERE id < $cursor ORDER BY id DESC LIMIT n`) — no count at all, and it
   uses the index directly. Use for feeds and infinite scroll.
2. **Count only on page 1**, then cache the total under the filter key and reuse it for pages 2..n.
3. **Approximate counts** from `pg_class.reltuples` for unfiltered totals on big tables.
4. Exact `COUNT(*)` only for small tables or admin screens that genuinely need it.

---

## Vercel: reducing function cost

### Eliminate invocations

- **Static-first.** Marketing, docs, blog, legal, pricing → `force-static`. These must show as `○`
  in the build output. One stray `cookies()` / `headers()` / `no-store` call turns a free CDN route
  into a billed function on every hit.
- **ISR over dynamic.** A page that changes hourly should be static with `revalidate`, not rendered
  per request.
- **Never let a Server Component fetch this project's own `/api`.** That is *two* invocations
  (the page and the route handler) plus a network round trip for one page view. Import the service.
- **One request = one function.** Do not chain internal HTTP calls between routes; call the shared
  service function directly.
- **`proxy.ts` runs on almost everything.** Narrow the matcher to exclude `_next/*`, assets, and
  public paths, and keep it to cookie/redirect logic only. These invocations are billed too.
  (Next.js 16 renamed `middleware.ts` to `proxy.ts`.)
- **Client-side navigation** between prefetched static routes costs nothing. Prefer it to full
  server round trips.
- **No cron jobs** unless the business requires them. A "cache warmer" cron pays for the warm-up on
  every schedule and usually costs more than the misses it prevents.

### Reduce time-per-invocation

- Vercel bills active CPU **and** wall-clock provisioned memory. A handler waiting 800 ms on a
  serial DB chain bills that wait. Parallelise everything independent.
- Keep memory at the smallest tier that fits — provisioned memory is a multiplier on duration.
- **Fluid Compute on** (default): concurrent requests share an instance, so idle await time is
  amortised across requests rather than billed separately per invocation. Do not disable it.
- Keep bundles lean; heavy top-level imports (`date-fns` whole, big SDKs, ORM plugins) inflate cold
  start on every fresh instance. Import narrowly, lazy-load the rest.
- `runtime = 'nodejs'` for DB routes. Edge is cheaper per invocation but adds a hop to the EU
  database from a random PoP — a slower query costs more than the runtime saves.

### Eliminate the other billed meters

- **Image Optimization** — disable it entirely; Cloudinary transforms instead (custom loader in
  `cloudinary.md`). Vercel image transforms are billed per source image.
- **Bandwidth** — media from the Cloudinary CDN, never proxied through a function or `/public`.
- **Log drains / observability** — sample in production; do not log full request/response bodies.
  The debug logger must be off unless `DEBUG_API=true`.
- **ISR writes** — a very short `revalidate`/`cacheLife` on many paths means constant regeneration.
  Prefer tags.

---

## Client-side settings that cost server money

```typescript
// QueryClient defaults — every one of these is a cost lever.
{
  staleTime: 5 * 60 * 1000,     // low staleTime = refetch storm = invocations + DB wake-ups
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,  // a user alt-tabbing must not wake Postgres
  refetchOnReconnect: false,
  refetchInterval: false,       // NEVER set an interval without an explicit business reason
  retry: 1,                     // retries multiply cost on a failing backend
}
```

Realtime feel is not worth a permanently awake database. If something genuinely needs live updates,
that is the one case to revisit — and the answer is a push channel, not polling.

---

## Cost review — apply to every PR

- [ ] Does this add a function invocation to a path that could be static or cached?
- [ ] Does it wake the database on a request that could be served from cache?
- [ ] Any new interval, cron, or polling refetch? Justify or delete.
- [ ] Are all independent queries batched into one round trip?
- [ ] Is there a new `COUNT(*)` on a hot path? Can it be cursor-paginated or cached?
- [ ] Does a Server Component fetch our own API instead of calling the service?
- [ ] New `proxy.ts` logic, or a widened matcher?
- [ ] New always-on dependency (Redis, queue, worker)? Default answer is no.
- [ ] Does the build output still show static routes as `○`?
- [ ] New public page: is it static, sitemapped, and free of per-request OG rendering?

---

## Crawlers are traffic you do not control

Search engine and social bots hit URLs on their own schedule, ignore your cache assumptions, and
will happily crawl an unbounded filter-parameter space. Uncontrolled, they are a recurring bill.

- Public pages static or ISR — a crawl of a static page costs nothing.
- `robots.ts` disallows `/api/`, private trees, and (usually) query-string URLs.
- Filtered/sorted list URLs are `noindex` and canonical to the clean path.
- `sitemap.ts` cached daily, never a per-request database read.
- OG images static or built at build time — never rendered per request (see the `seo` skill).
- Preview deployments blocked in `robots.ts` via `VERCEL_ENV`, or they get crawled too.

---

## Monitoring what you spend

- Vercel dashboard → Usage: invocations, GB-hours, image transforms, bandwidth. Check per-route.
- Neon console → Monitoring: **compute hours** and the active/idle timeline. A flat "always active"
  line means something is polling — find it and kill it.
- Neon `list_slow_queries` before adding a CU. A missing index is cheaper to fix than to outrun.
