# Caching & Revalidation

Caching is the main cost lever, and cost is priority #1 — read `cost-optimization.md` alongside
this file. Every cache hit is a Vercel invocation that is not billed and a Neon endpoint that stays
suspended. Default position — **serve from the CDN; wake the database only on a miss or a write.**

Remember what Neon actually bills: **time awake, not query count**. A cheap query every 30 seconds
costs far more than an expensive one every hour, because the endpoint never suspends. Cache to
reduce *frequency of contact*, not just data volume.

```text
User → Vercel CDN → (hit) response
                  → (miss) Next.js → Hono → Next.js Data Cache → (miss) Neon
```

---

## Decision table

| Content                                     | Strategy                                          | Cost when done right |
| ------------------------------------------- | ------------------------------------------------- | -------------------- |
| `/`, `/about`, `/pricing`, marketing pages   | Fully static (no dynamic APIs) — pure CDN          | 0 functions, 0 DB    |
| `sitemap.ts` / `robots.ts`                   | Cached route handlers, daily `revalidate`         | ~0 — see `seo` skill |
| Blog posts, docs                             | Static + `generateStaticParams`                   | 0 functions, 0 DB    |
| Products, categories, public profiles        | `'use cache'` + tags, revalidated on write        | 1 function, 0 DB     |
| Public settings, feature flags               | Long `cacheLife` + tag invalidation on save       | 1 function, 0 DB     |
| Dashboard lists (per-user)                   | No shared cache; TanStack Query, long `staleTime` | 1 function, 1 wake   |
| Anything user-specific or auth-gated         | Never cached at the CDN; `Cache-Control: private` | 1 function, 1 wake   |

Push every row upward in this table wherever the product allows. A public page rendered per request
is the single most expensive mistake available in this stack.

---

## Static pages

Do not call `cookies()`, `headers()`, or `fetch(..., { cache: 'no-store' })` in a page that should
be static — a single such call opts the whole route into dynamic rendering, turning a free CDN hit
into a billed function invocation on **every** visit. This is the most common accidental cost
regression in a Next.js app.

Check `pnpm build` output after any change to a marketing route: `○` = static (free),
`ƒ` = dynamic (billed per request). Treat an `○ → ƒ` change as a build failure.

```tsx
// app/(marketing)/pricing/page.tsx
export const dynamic = 'force-static';
export const revalidate = 3600;
```

---

## Cached data access — `'use cache'` (Next.js 16)

Next.js 16 ships **Cache Components**. `'use cache'` + `cacheTag` + `cacheLife` is the current API;
`unstable_cache` is the legacy path kept only for projects that have not enabled it.

Enable it once:

```typescript
// next.config.ts
const nextConfig: NextConfig = { cacheComponents: true };
```

Wrap the **repository** call, not the route handler:

```typescript
// src/server/services/product-service.ts
import { cacheLife, cacheTag } from 'next/cache';
import { productRepository } from '@/server/repositories/product-repository';

export async function getPublicProducts(params: { page: number; limit: number }) {
  'use cache';
  cacheTag(CACHE_TAGS.list('products'));
  cacheLife('hours'); // seconds | minutes | hours | days | weeks | max
  return productRepository.list(params);
}
```

The cache key is derived from the function's **arguments** automatically — no hand-written key
array, and no chance of the stale-key bug `unstable_cache` invites.

Rules:

- **Never read `cookies()` or `headers()` inside a `'use cache'` scope.** Read them outside and pass
  the values in as arguments. Anything else either fails or silently caches per-request data.
- Never cache a per-user query under a shared key. If it must be cached, the user id is an explicit
  argument (and part of the tag).
- Pick `cacheLife` from real staleness tolerance: `hours`/`days` for reference data, `minutes` only
  when the product demands it. `seconds` is polling by another name — it re-wakes Neon forever.
- Prefer tags over short lifetimes. Writes invalidate; time does not have to.
- `'use cache: private'` exists for per-viewer data that cannot be refactored to arguments — it is
  a last resort, not a shortcut.

### Legacy: `unstable_cache`

Only for a project without `cacheComponents`. The key array must contain **every** input — a
missing parameter serves one caller's data to another:

```typescript
export const getPublicProducts = (params: { page: number; limit: number }) =>
  unstable_cache(() => productRepository.list(params), ['products:list', JSON.stringify(params)], {
    tags: [CACHE_TAGS.list('products')],
    revalidate: 3600,
  })();
```

---

## Tag naming convention

```typescript
// src/lib/cache/tags.ts
export const CACHE_TAGS = {
  list: (resource: string) => `${resource}:list`,
  detail: (resource: string, id: string) => `${resource}:${id}`,
  all: (resource: string) => resource,
} as const;
```

Every resource registers the same three shapes so invalidation is mechanical. Tags are
case-sensitive and capped at 256 characters.

---

## On-demand revalidation

Invalidate at the moment of the write, in the service layer — never on a timer "just in case".

```typescript
import { revalidateTag, revalidatePath } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cache/tags';

async function updateProduct(id: string, input: UpdateProductInput) {
  const row = await productRepository.update(id, input);
  revalidateTag(CACHE_TAGS.list('products'));
  revalidateTag(CACHE_TAGS.detail('products', id));
  revalidatePath(`/products/${row.slug}`); // static page regeneration
  return row;
}
```

`revalidateTag` works in **Route Handlers and Server Actions** — the service is called from a Hono
handler, so it is valid there.

`updateTag` (Next.js 16) is the **Server Actions only** variant: it expires the tag immediately and
the next request waits for fresh data, instead of serving stale content once. Use it for
read-your-own-writes (a user submits a form and must see their change); use `revalidateTag`
everywhere else, including all Hono routes.

---

## HTTP cache headers on the Hono API

For public, cacheable GET routes, let the Vercel CDN hold the response:

```typescript
import { Hono } from 'hono';
import { ok } from '@/server/lib/response';

export const products = new Hono().get('/', async (c) => {
  const data = await getPublicProducts({ page: 1, limit: 20 });
  // Serve stale for a day while revalidating in the background.
  c.header('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return ok(c, data.rows);
});
```

For anything authenticated:

```typescript
c.header('Cache-Control', 'private, no-store');
```

Getting this backwards leaks one user's data to another from the shared CDN. When in doubt,
`private, no-store`.

---

## Client cache (TanStack Query)

Client-side caching is the last layer, not a substitute for the two above. Every client refetch is a
billed invocation **and** a Neon wake-up, so the defaults matter more than they look:

```typescript
{
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,  // alt-tabbing must not wake Postgres
  refetchOnReconnect: false,
  refetchInterval: false,       // never set without an explicit business reason
  retry: 1,
}
```

`refetchInterval` is the most expensive line anyone can add to this codebase: N open tabs × the
interval = a database that never suspends. If live data is genuinely required, say so explicitly and
choose a push mechanism — do not poll.

Prefer `invalidateQueries` after a mutation (one refetch, on demand) over any interval.

---

## Redis

Do not add Redis. Next.js Data Cache + Vercel CDN cover the workload. Revisit only with evidence:
cross-instance rate limiting, or a hot key that measurably breaks the tag model. If that day comes,
Upstash Redis is the option — still one dependency, no new service to run.

---

## Cost checklist

- [ ] Marketing/static routes render with zero function invocations (`○` in the build output)
- [ ] No page opts into dynamic rendering by accident (stray `cookies()` / `headers()`)
- [ ] Every public read path is cached with a tag
- [ ] Writes invalidate tags — no short polling intervals anywhere
- [ ] Authenticated responses send `private, no-store`
- [ ] Server Components call services directly instead of fetching their own API over HTTP
- [ ] Media served from Cloudinary, never proxied through a function
- [ ] No `refetchInterval`, cron, or uptime monitor touches a database-backed route
- [ ] `/api/health` returns a static object and never queries
- [ ] Independent queries in one request are batched into a single round trip
- [ ] Neon autosuspend set to the minimum; monitoring shows idle gaps, not a flat active line

See `cost-optimization.md` for the full cost model and the per-PR review list.
