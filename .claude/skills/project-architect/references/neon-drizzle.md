# Neon PostgreSQL + Drizzle ORM

Serverless Postgres in a European region (Ireland users → `aws-eu-west-1` Dublin, or `aws-eu-central-1`),
accessed through the Neon serverless driver and Drizzle ORM.

**Cost model — internalise this before writing a query.** Neon bills **compute hours: wall-clock
time the endpoint is awake**, not queries executed. Scale-to-zero only pays off if the app actually
lets it suspend. One trivial query per minute costs the same as thousands — the endpoint simply
never sleeps. Therefore:

- Optimise for **fewer contacts**, not just cheaper queries.
- Anything periodic is the enemy. No polling, no cron pings, no querying health checks.
- Cache hits are free; a wake-up is not. See `cost-optimization.md` and `caching.md`.

```text
Hono API → Service → Repository → Drizzle ORM → Neon serverless driver → Neon Postgres (EU)
```

## Setup commands to append

```bash
pnpm add drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit
# schema changes → SQL:
pnpm drizzle-kit generate
# apply to the database:
pnpm drizzle-kit migrate
```

Add to `package.json` scripts:

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "db:push": "drizzle-kit push"
}
```

> `db:push` is for local prototyping only. Anything that reaches production goes through
> `generate` + `migrate` so the SQL is reviewable and reversible.

---

## Environment variables

```text
DATABASE_URL           # pooled connection (-pooler host) — used by the app
DATABASE_URL_UNPOOLED  # direct connection — used by drizzle-kit migrations only
```

Both are server-only. Never prefix them with `NEXT_PUBLIC_`.

---

## Endpoint settings (do this once, it is the biggest single saving)

In the Neon console → Branch → Compute:

| Setting              | Value                     | Why                                                          |
| -------------------- | ------------------------- | ------------------------------------------------------------ |
| Suspend after        | **minimum available**     | Idle minutes are billed until it suspends                     |
| Min compute size     | **0.25 CU**               | The minimum is billed for every awake second                  |
| Max compute size     | 1–2 CU                    | Autoscale ceiling; raise only on measured slow queries        |
| Preview branches     | same, or deleted          | Every branch has its own compute and its own bill             |

Check the Monitoring tab after deploying. A flat "always active" line means something is polling —
find it and remove it before tuning anything else.

---

## Folder layout

```text
src/server/db/
├── index.ts            # the single db instance
├── schema/
│   ├── index.ts        # re-exports every table
│   └── <table>.ts      # one file per table
└── migrations/         # generated SQL, committed to git
```

---

## `src/server/db/index.ts`

One module-scope instance. Import it; never construct a client per request.

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

// neon-http: one stateless HTTP round trip per query, nothing held open — so the compute
// endpoint can suspend the instant the query returns. This is the cheap default and it is
// why we do NOT use a WebSocket Pool: an open pool keeps the endpoint awake and billing.
const sql = neon(connectionString);

export const db = drizzle(sql, { schema, logger: process.env.NODE_ENV === 'development' });
export type Db = typeof db;
export { schema };
```

Rules:

- Module-scope instance, reused across warm invocations. Do **not** open a connection per request.
- `logger: true` only in development — production query logging costs log-drain volume.
- `neon-http` has no interactive multi-statement transactions. Prefer to avoid needing one: a
  single statement with `WITH`/`RETURNING` usually does the job. If a real transaction is
  unavoidable, create the pooled client **inside** that operation and close it when done, so it
  cannot hold the endpoint awake:

  ```typescript
  import { Pool } from '@neondatabase/serverless';
  import { drizzle } from 'drizzle-orm/neon-serverless';

  // Use sparingly. An always-open module-scope Pool prevents autosuspend and bills 24/7.
  export async function withTransaction<T>(fn: (tx: ReturnType<typeof drizzle>) => Promise<T>) {
    const pool = new Pool({ connectionString });
    try {
      return await drizzle(pool, { schema }).transaction(fn);
    } finally {
      await pool.end();
    }
  }
  ```

- **Batch every independent read.** `Promise.all` / `db.batch([...])` collapses N sequential
  round trips into one awake window; a serial chain bills the *sum* of every latency on both
  meters. Never `await` queries one after another in a request unless the second genuinely needs
  the first one's result.

  ```typescript
  // ✅ one awake window, one function-duration window
  const [user, orders, unread] = await Promise.all([
    userRepository.byId(id),
    orderRepository.recentFor(id),
    notificationRepository.unreadCount(id),
  ]);
  ```

- **Do not query on the auth path.** Resolve the session from a signed cookie/JWT carrying the user
  id, role and permission bits. Hitting the users table on every request means every page view
  wakes Postgres — the single most expensive pattern in a dashboard app.

---

## `drizzle.config.ts` (project root)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema/index.ts',
  out: './src/server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // migrations run over the direct (unpooled) connection
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
```

---

## Table pattern — `src/server/db/schema/<table>.ts`

```typescript
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: varchar('reference', { length: 32 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 24 }).notNull().default('pending'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Index every column used in a WHERE / ORDER BY / JOIN of a real query.
    index('orders_user_id_idx').on(table.userId),
    index('orders_status_created_at_idx').on(table.status, table.createdAt),
  ],
);

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));

// Drizzle-inferred types — the single source of truth for row shapes.
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
```

Conventions:

- Table + column names: `snake_case` in Postgres, `camelCase` in the TS object.
- Timestamps: always `withTimezone: true`.
- Every foreign key gets an index; Postgres does not create one automatically.
- Composite index column order = most selective / equality columns first, sort column last.

---

## Repository pattern — `src/server/repositories/<resource>-repository.ts`

Drizzle queries live **here only**. Services and routes never import `db` directly.

```typescript
import { and, asc, count, desc, eq, ilike, type SQL } from 'drizzle-orm';
import { db } from '@/server/db';
import { orders, type NewOrder, type Order } from '@/server/db/schema/orders';

export interface OrderListParams {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sort?: 'createdAt' | 'reference';
  order?: 'asc' | 'desc';
}

// Select only the columns the caller needs — never the whole row by default.
const listColumns = {
  id: orders.id,
  reference: orders.reference,
  status: orders.status,
  createdAt: orders.createdAt,
};

export const orderRepository = {
  async list(params: OrderListParams): Promise<{ rows: Array<Pick<Order, 'id' | 'reference' | 'status' | 'createdAt'>>; total: number }> {
    const filters: SQL[] = [];
    if (params.status) filters.push(eq(orders.status, params.status));
    if (params.search) filters.push(ilike(orders.reference, `%${params.search}%`));
    const where = filters.length ? and(...filters) : undefined;

    const sortColumn = params.sort === 'reference' ? orders.reference : orders.createdAt;
    const direction = params.order === 'asc' ? asc : desc;

    // Both queries in one round trip — no waterfall.
    const [rows, [totals]] = await Promise.all([
      db
        .select(listColumns)
        .from(orders)
        .where(where)
        .orderBy(direction(sortColumn))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit),
      db.select({ value: count() }).from(orders).where(where),
    ]);

    return { rows, total: totals?.value ?? 0 };
  },

  // Relational query API: one SQL statement with a join — not an N+1 loop.
  byId: (id: string) =>
    db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { user: { columns: { id: true, email: true } } },
    }),

  async create(values: NewOrder) {
    const [row] = await db.insert(orders).values(values).returning();
    return row;
  },

  async update(id: string, values: Partial<NewOrder>) {
    const [row] = await db
      .update(orders)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return row;
  },

  remove: (id: string) => db.delete(orders).where(eq(orders.id, id)),
};
```

---

## Service pattern — `src/server/services/<resource>-service.ts`

Business rules, authorisation checks and cache orchestration. See `caching.md` for the tag helpers.

```typescript
import { cacheLife, cacheTag, revalidateTag } from 'next/cache';
import { ApiError } from '@/server/lib/errors';
import { orderRepository, type OrderListParams } from '@/server/repositories/order-repository';

const listTag = 'orders:list';
const detailTag = (id: string) => `orders:${id}`;

// Next.js 16 Cache Components. The cache key comes from the arguments, so every
// parameter is accounted for automatically. Requires cacheComponents: true.
// Never read cookies()/headers() inside a 'use cache' scope — pass values in as arguments.
async function listCached(params: OrderListParams) {
  'use cache';
  cacheTag(listTag);
  cacheLife('minutes'); // raise to 'hours'/'days' for slower-moving data
  return orderRepository.list(params);
}

async function byIdCached(id: string) {
  'use cache';
  cacheTag(detailTag(id));
  cacheLife('hours');
  return orderRepository.byId(id);
}

export const orderService = {
  list: listCached,
  byId: byIdCached,

  async create(input: { reference: string; notes?: string }, userId: string) {
    const row = await orderRepository.create({ ...input, userId });
    revalidateTag(listTag);
    return row;
  },

  async update(id: string, input: Partial<{ status: string; notes: string }>) {
    const row = await orderRepository.update(id, input);
    if (!row) throw ApiError.notFound('Order not found');
    revalidateTag(listTag);
    revalidateTag(detailTag(id));
    return row;
  },

  async remove(id: string) {
    await orderRepository.remove(id);
    revalidateTag(listTag);
    revalidateTag(detailTag(id));
  },
};
```

> Only cache reads that are safe to serve slightly stale, and never cache a query whose result
> depends on the current user unless the user id is an explicit argument (and part of the tag).
>
> On a project without `cacheComponents`, use the legacy `unstable_cache` form shown in
> `caching.md` — and make sure every input appears in the key array.

---

## Pagination — avoid the second query

`COUNT(*)` over a filtered table often costs more than the page itself, and it doubles the work in
every list request. Ranked cheapest first:

**1. Cursor pagination** — no count, index-only, constant cost at any depth. Default for feeds,
infinite scroll, and any list where a total is not displayed.

```typescript
async listByCursor({ cursor, limit }: { cursor?: string; limit: number }) {
  return db
    .select(listColumns)
    .from(orders)
    .where(cursor ? lt(orders.createdAt, new Date(cursor)) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(limit + 1); // one extra row answers hasNextPage without a count
}
```

**2. Count once, cache it** — when the UI needs page numbers, compute the total on page 1 only and
cache it under the filter key; pages 2..n reuse it.

**3. Approximate totals** for unfiltered counts on large tables:
`SELECT reltuples::bigint FROM pg_class WHERE relname = 'orders'`.

**4. Exact `COUNT(*)`** only for small tables or admin screens that truly need it.

Offset pagination also degrades with depth — `OFFSET 10000` still scans 10 000 rows. Cursor
pagination is the cheaper answer there too.

---

## Query rules (enforce in review)

1. Index every column used in `WHERE`, `ORDER BY`, or a join condition. A missing index is billed as
   compute time on every call — cheaper to add than to outrun with a bigger CU.
2. Paginate every list endpoint. Cap `limit` in the Zod schema (e.g. `.max(100)`).
3. Select named columns; no implicit `SELECT *` on wide tables — less data, less CPU, less egress.
4. No N+1: use `db.query...with` or a single join, never a loop of awaits.
5. One request = one awake window. Batch with `Promise.all` / `db.batch`.
6. Cache frequently read, rarely written public data; invalidate by tag on write.
7. Prefer cursor pagination; if a count is unavoidable, issue it in the same round trip as the page.
8. Keep the connection module-scoped and stateless (`neon-http`) so the endpoint can suspend.
9. Bulk-write: one `insert().values([...])` / one `update` with a `CASE`, never a loop.
10. Verify with `EXPLAIN` (`explain_sql_statement`) before shipping any query on a hot path; check
    `list_slow_queries` in the Neon console after.
