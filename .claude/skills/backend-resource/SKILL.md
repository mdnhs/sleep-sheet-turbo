---
name: backend-resource
description: >
  Use this skill whenever the user wants to add or change server-side data or endpoints in the
  Next.js + Hono + Neon/Drizzle project. Triggers include: "add an API endpoint", "create a Hono
  route", "add a table", "create a database schema for X", "write a migration", "add a repository /
  service", "expose X over the API", "make this query faster", "reduce Neon compute hours", "this endpoint is
  too expensive", or any backend-only work that does not need frontend pages. For a full-stack entity (backend + pages + hooks), use the new-feature
  skill instead — it calls this one for its backend half. Always consult this skill before writing
  Drizzle schema, Hono routes, or server services — do not improvise the layering.
---

# Backend Resource Scaffolder

Generates one server-side resource end to end:

```text
Zod schema  →  Hono route module  →  Service (cache + rules)  →  Repository (Drizzle)  →  Neon
```

**Cost is priority #1 in this project: fewer Vercel invocations, fewer Neon compute hours.** Neon
bills time awake, not queries — so the goal is to touch the database *less often*, not merely to
write faster SQL.

Read these references before generating — they hold the full source patterns:

- `../project-architect/references/cost-optimization.md` — **read first**; the cost model
- `../project-architect/references/hono-api.md` — envelope, `ApiError`, middleware, route module
- `../project-architect/references/neon-drizzle.md` — schema, indexes, repository, service
- `../project-architect/references/caching.md` — `'use cache'`, tags, invalidation, headers

---

## Before You Start

1. **Resource name**, singular + plural (`order` / `orders`)
2. **Fields** — name, type, nullable, default, unique
3. **Relations** — which tables it references, and the delete behaviour (`cascade` / `restrict`)
4. **Operations** — list / detail / create / update / delete / custom
5. **Access** — public, authenticated, or permission-gated (and the permission key)
6. **Cacheable?** — is the read data public and safe to serve slightly stale? For how long?
7. **Query patterns** — which fields are filtered, sorted, or searched (these become indexes)
8. **Will any of this data appear on a public, indexable page?** If so it needs a stable slug column
   (unique + indexed) and an `updatedAt` the sitemap can use for `lastModified`. Adding those later
   means a migration plus a redirect map.
9. **Does the UI need a total count?** If not, use cursor pagination and skip `COUNT(*)` entirely.
10. **How fresh must it be?** This sets `revalidate` and client `staleTime`. "Real time" is
   expensive — confirm it is a real requirement before agreeing to it.

Do not guess 3, 5 or 6. Ask if unclear: getting caching or authorisation wrong is a data leak,
not a style issue.

**Never add** a cron job, a `refetchInterval`, or a scheduled warm-up as part of a resource. Each
one keeps the Neon endpoint awake permanently. If something seems to need one, raise it instead of
building it.

---

## Step 1 — Schema — `src/server/db/schema/<plural>.ts`

```typescript
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // …fields…
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('orders_status_created_at_idx').on(table.status, table.createdAt)],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
```

Then:

- Re-export from `src/server/db/schema/index.ts`.
- Add an index for every foreign key and every field named in step 7.
- `pnpm db:generate` → review the generated SQL → `pnpm db:migrate`. Commit the SQL file.

**Never** hand-edit an already-applied migration. Write a new one.

---

## Step 2 — Validation — `src/validations/<resource>-schema.ts`

Shared by the Hono validators and the client forms. One source of truth.

```typescript
import { z } from 'zod';

export const createOrderSchema = z.object({
  reference: z.string().min(1).max(32),
  notes: z.string().max(2000).optional(),
});

export const updateOrderSchema = createOrderSchema.partial();

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20), // always capped
  status: z.string().optional(),
  search: z.string().max(100).optional(),
  sort: z.enum(['createdAt', 'reference']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
```

`sort` must be an `enum` of real column names — never interpolate a raw string into an order clause.

---

## Step 3 — Repository — `src/server/repositories/<resource>-repository.ts`

The only file that imports `db` for this resource. Follow the pattern in `neon-drizzle.md`:

- **Cursor pagination by default** — `WHERE created_at < $cursor ORDER BY created_at DESC LIMIT n+1`.
  No `COUNT(*)`, index-only, constant cost at any depth.
- Only when the UI shows page numbers: page query and `count()` issued together in one
  `Promise.all`, and the total cached under the filter key so pages 2..n do not recount.
- Select named columns, not the whole row — less CPU, less egress, shorter awake window.
- Detail: `db.query.<table>.findFirst({ with: … })` — one statement, no N+1.
- Mutations use `.returning()` so the service never re-reads.
- Bulk writes are one statement (`insert().values([...])`), never a loop of awaits.
- Anything on a hot path gets an `EXPLAIN` check before it ships.

---

## Step 4 — Service — `src/server/services/<resource>-service.ts`

Business rules, authorisation beyond a permission check, and cache orchestration.

```typescript
import { cacheLife, cacheTag, revalidateTag } from 'next/cache';
import { CACHE_TAGS } from '@/lib/cache/tags';
import { ApiError } from '@/server/lib/errors';
import { orderRepository } from '@/server/repositories/order-repository';

const LIST_TAG = CACHE_TAGS.list('orders');
const detailTag = (id: string) => CACHE_TAGS.detail('orders', id);

// Next.js 16 Cache Components: the key is derived from the arguments.
// No cookies()/headers() inside a 'use cache' scope — pass values in as arguments.
async function listCached(query: OrderListQuery) {
  'use cache';
  cacheTag(LIST_TAG);
  cacheLife('minutes'); // set from real staleness tolerance
  return orderRepository.list(query);
}

export const orderService = {
  list: listCached,

  async update(id: string, input: UpdateOrderInput) {
    const row = await orderRepository.update(id, input);
    if (!row) throw ApiError.notFound('Order not found');
    revalidateTag(LIST_TAG);
    revalidateTag(detailTag(id));
    return row;
  },
};
```

Caching rules (this is where the money is):

- Cache only when the answer to "Before You Start" #6 was yes.
- Per-user data: either no cache, or the user id is part of the cache key **and** the tag.
- Every mutation invalidates the list tag plus the affected detail tag. No timers.
- Set `cacheLife` from how stale the data may safely be — `'hours'`/`'days'` for reference data.
  `'seconds'` is polling by another name: it re-wakes Neon on a schedule forever.
- `revalidateTag` in Hono handlers. `updateTag` only inside Server Actions, when the user must
  immediately see their own write.
- Batch independent reads inside a service method with `Promise.all` so one request = one awake
  window.
- Never look up the acting user in the database to authorise a request — read the claims off the
  signed session token.

---

## Step 5 — Route module — `src/server/api/<plural>.ts`

Thin handlers, per `hono-api.md`:

```typescript
export const orders = new Hono<AuthEnv>()
  .use('*', requireAuth)
  .get('/', requirePermission('order_management.order.view_list'), zValidator('query', orderListQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const { rows, total } = await orderService.list(query);
    return ok(c, rows, { pagination: buildPagination(total, query.page, query.limit) });
  });
```

- `zValidator` from `@/server/lib/validator` (the one that produces the shared error envelope).
- Throw `ApiError`; never build an error response by hand.
- Public GET routes: set `Cache-Control: public, s-maxage=…, stale-while-revalidate=…` so the CDN
  answers repeat requests with no invocation at all. Authenticated routes: `private, no-store`.
- Server Components must call `<resource>Service` directly — never fetch this route over HTTP.
  A self-fetch bills two invocations and a network round trip per page view.

Mount it in `src/server/api/index.ts` **inside the existing export chain** — breaking the chain
loses the RPC types:

```typescript
export const api = app
  .get('/health', …)
  .route('/auth', auth)
  .route('/orders', orders);
```

---

## Step 6 — Register the route path

`src/lib/routes/api-routes.ts`:

```typescript
orders: {
  list: '/orders',
  create: '/orders',
  detail: (id: string) => `/orders/${id}`,
  update: (id: string) => `/orders/${id}`,
},
```

Permissions (if gated) go in `src/lib/permission/permissions.ts` with the same keys used in
`requirePermission`.

---

## Verification

- [ ] `pnpm db:generate` produced SQL that matches the intended change; migration applied
- [ ] `pnpm tsc --noEmit` clean; no `any`
- [ ] Every filter/sort/join column has an index
- [ ] `limit` is capped; list responses carry `pagination`
- [ ] Auth/permission middleware present on every non-public route
- [ ] Cache tags invalidated by all three mutations
- [ ] Manual check of one route: success envelope, a 422 validation body, and a 404
- [ ] No `db` import outside the repository; no SQL in the route file

Cost review:

- [ ] No `COUNT(*)` on a hot path (cursor pagination, or the total is cached)
- [ ] Independent queries batched into one `Promise.all` — no serial await chain
- [ ] Public reads cached by tag; `Cache-Control` set correctly per route
- [ ] `cacheLife` chosen from real staleness tolerance, not a reflexive small number
- [ ] No cron, no interval, no scheduled warm-up added
- [ ] Auth path does not query the database
- [ ] Read-only pages consume the service directly rather than fetching the API
