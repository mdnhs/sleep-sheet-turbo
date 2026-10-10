---
name: new-feature
description: >
  Use this skill whenever the user wants to scaffold, create, or add a new feature module to their
  Next.js enterprise project. Triggers include: "add a new feature", "create a module for X",
  "scaffold [entity] CRUD", "add [entity] to the project", "create pages for [entity]", or any
  request to build out a new domain entity (users, orders, products, invoices, etc.).
  Always use this skill when generating files that need to follow the project's feature-based
  architecture — do NOT improvise the structure without consulting this skill first.
---

# Next.js Feature Scaffolder

Generates a complete, architecture-compliant **full-stack** feature module: Drizzle table → Hono
route → frontend feature module → App Router pages.

```text
src/server/db/schema  →  repository  →  service  →  Hono route   ← backend  (backend-resource skill)
                                             ↓
src/features/<name>   →  service  →  TanStack Query hooks  →  components   ← frontend (this skill)
                                             ↓
src/app/(main)/…      →  RSC pages
```

**Cost is priority #1: fewer Vercel invocations, fewer Neon compute hours.** Neon bills time awake,
so the frontend half matters as much as the backend — refetch settings decide how often Postgres is
woken up.

Read before generating:

- `../project-architect/references/cost-optimization.md` — **read first**; the cost model
- `../project-architect/references/hono-api.md` — response envelope the frontend service parses
- `../project-architect/references/caching.md` — what is cached where
- `../backend-resource/SKILL.md` — the backend half, step by step

---

## Before You Start

1. Confirm the **feature name** (e.g. `orders`, `invoices`, `customers`)
2. Confirm the **fields and relations** — needed for the Drizzle table
3. Confirm which **CRUD operations** are needed: list / create / edit / details / delete
4. Confirm the **API base path** (e.g. `/orders`) — check `lib/routes/api-routes.ts` if unsure
5. Check if a **permission prefix** is needed (e.g. `order_management.order`)
6. Ask if this feature lives under `(dashboard_layout)` or `(global_layout)`
7. Decide **where each read renders**: RSC (server-fetched, cheapest — no client fetch at all) vs
   client (interactive table with filters, sorting, pagination). Default to RSC and add client
   interactivity only where the UI truly needs it.
8. Decide **staleness tolerance per view**. This sets `cacheLife` server-side and `staleTime`
   client-side. Reference lists (roles, categories, statuses) belong at 30–60 minutes.
9. Confirm **no live/polling requirement**. If someone asks for auto-refresh, push back: N open
   tabs × an interval = a database that never suspends and bills like an always-on server.

**Backend-only request?** (a table, an endpoint, a query fix) — use the `backend-resource` skill
alone and skip everything below Step 2.

---

## Step 0 — Backend

Follow `backend-resource/SKILL.md` in full for this entity:

- `src/server/db/schema/<plural>.ts` + `db:generate` / `db:migrate`
- `src/validations/<feature>-schema.ts` — Zod schemas, shared with the forms below
- `src/server/repositories/<feature>-repository.ts`
- `src/server/services/<feature>-service.ts` — cache tags + invalidation
- `src/server/api/<plural>.ts` mounted in the `src/server/api/index.ts` export chain

Do not start the frontend until `/api/<plural>` returns a real response. Building the UI against a
guessed payload shape wastes both halves.

---

## Step 1 — App Router Pages

```text
src/app/(main)/(protected)/(dashboard_layout)/(feature-group)/[feature-name]/
├── (list)/
│   ├── layout.tsx
│   └── page.tsx
├── (mutation)/
│   ├── create/
│   │   └── page.tsx
│   └── [id]/
│       └── edit/
│           └── page.tsx
└── [id]/
    └── page.tsx
```

### Detail page — Server Component, no client fetch

A page that only renders data calls the **server service directly**. No `'use client'`, no loading
spinner, no second function invocation.

```tsx
import { notFound } from 'next/navigation';
import { orderService } from '@/server/services/order-service';
import { OrderDetails } from '@/features/orders/components/details';

// Next.js 16: params and searchParams are Promises — await them.
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await orderService.byId(id);
  if (!order) notFound();
  return <OrderDetails order={order} />;
}
```

### List page — client table, server-rendered first page

```tsx
import { OrderTable } from '@/features/orders/components/list/order-table';

export default function OrderListPage() {
  return <OrderTable />;
}
```

Use the RSC form when the list is read-only — it costs one invocation and no client fetch. Use the
client table only when it needs filters, sorting, and pagination driven by search params (NUQS).

When the client table is needed, still render the first page on the server and seed the client
cache with `initialData`, so the initial view costs zero extra invocations:

```tsx
const { rows } = await orderService.list({ page: 1, limit: 20 });
return <OrderTable initialData={rows} />;
```

### layout.tsx pattern (list)

```tsx
export default function OrderListLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

---

## Step 2 — Feature Module Structure

```text
src/features/[feature-name]/
├── components/
│   ├── list/
│   │   ├── columns.tsx
│   │   ├── [feature]-table.tsx
│   │   └── [feature]-table-filter.tsx
│   ├── create/index.tsx
│   ├── edit/index.tsx
│   ├── details/index.tsx
│   └── index.tsx
├── hooks/
│   └── api/
│       ├── mutation/
│       │   ├── use-create-[feature].ts
│       │   ├── use-update-[feature].ts
│       │   └── use-delete-[feature].ts
│       └── query/
│           ├── use-[feature]-list.ts
│           └── use-[feature]-detail.ts
├── services/
│   ├── api.ts
│   └── service.ts
├── types/index.ts
├── utils/
│   ├── constants.ts
│   └── query-keys.ts
└── validations/            # only feature-local, form-only schemas
```

`mapper.ts` is generated **only** when the backend is an external `snake_case` API. When the Hono
API in this project serves the feature, it already returns `camelCase` — a mapper would be dead code.

---

## Step 3 — File Templates

### `types/index.ts`

Derive from the Drizzle table instead of retyping the row.

```typescript
import type { Order } from '@/server/db/schema/orders';
import type { CreateOrderInput, UpdateOrderInput } from '@/validations/order-schema';

// Type-only import of a server type is safe — it is erased at build time.
export type { Order, CreateOrderInput, UpdateOrderInput };

// The subset the list endpoint actually returns.
export type OrderListItem = Pick<Order, 'id' | 'reference' | 'status' | 'createdAt'>;
```

> For an **external** backend instead, keep the old shape: `OrderApiResponse` with snake_case
> fields plus `export type Order = CamelCaseKeys<OrderApiResponse>`.

### `utils/query-keys.ts`

```typescript
export const ORDER_QUERY_KEYS = {
  all: ['orders'] as const,
  lists: () => [...ORDER_QUERY_KEYS.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...ORDER_QUERY_KEYS.lists(), filters] as const,
  details: () => [...ORDER_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...ORDER_QUERY_KEYS.details(), id] as const,
};
```

### `services/api.ts`

```typescript
import { API_ROUTES } from '@/lib/routes/api-routes';
import { del, get, patch, post } from '@/lib/api-client';
import type { CreateOrderInput, UpdateOrderInput } from '../types';

export const orderApi = {
  list: (params: Record<string, string>) => get(API_ROUTES.orders.list, params),
  detail: (id: string) => get(API_ROUTES.orders.detail(id)),
  create: (data: CreateOrderInput) => post(API_ROUTES.orders.create, data),
  update: (id: string, data: UpdateOrderInput) => patch(API_ROUTES.orders.update(id), data),
  delete: (id: string) => del(API_ROUTES.orders.detail(id)),
};
```

Alternative when the project uses Hono RPC: replace this file with `rpc.api.orders.$get(...)` calls
and drop the manual generics — types flow from the server.

### `services/service.ts`

Unwraps the `{ success, data, error }` envelope into `ServiceResponse`.

```typescript
import type { ServiceResponse } from '@/types';
import { orderApi } from './api';
import type { CreateOrderInput, Order, OrderListItem } from '../types';

const unwrap = <T>(response: Awaited<ReturnType<typeof orderApi.detail>>): ServiceResponse<T> => {
  const body = response.data;
  if (!body || body.success === false) {
    return {
      error: true,
      message: body?.error?.message ?? 'Request failed',
      data: null,
      causes: body?.error?.causes,
      status: response.status,
    };
  }
  return { error: false, message: 'Success', data: body.data as T, pagination: body.pagination };
};

export const orderService = {
  async getList(params: Record<string, unknown>): Promise<ServiceResponse<OrderListItem[]>> {
    const query = Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    );
    return unwrap<OrderListItem[]>(await orderApi.list(query));
  },

  async getDetail(id: string): Promise<ServiceResponse<Order>> {
    return unwrap<Order>(await orderApi.detail(id));
  },

  async create(data: CreateOrderInput): Promise<ServiceResponse<Order>> {
    return unwrap<Order>(await orderApi.create(data));
  },
};
```

### `hooks/api/query/use-[feature]-list.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { orderService } from '../../../services/service';
import { ORDER_QUERY_KEYS } from '../../../utils/query-keys';

export const useOrderList = (filters: Record<string, unknown> = {}, initialData?: OrderListItem[]) =>
  useQuery({
    queryKey: ORDER_QUERY_KEYS.list(filters),
    queryFn: () => orderService.getList(filters),
    // Cost lever: every refetch is a billed invocation and a Neon wake-up.
    // Set this from how fast the data actually changes — minutes, not seconds.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    // NEVER add refetchInterval here. Invalidate after mutations instead.
    initialData,
  });
```

### `hooks/api/mutation/use-create-[feature].ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { orderService } from '../../../services/service';
import { ORDER_QUERY_KEYS } from '../../../utils/query-keys';
import type { CreateOrderInput } from '../../../types';

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderInput) => orderService.create(data),
    onSuccess: (response) => {
      if (response.error) return toast.error(response.message);
      queryClient.invalidateQueries({ queryKey: ORDER_QUERY_KEYS.lists() });
      toast.success(response.message);
    },
    onError: () => toast.error('Something went wrong'),
  });
};
```

Server-side cache tags are invalidated by the **service layer on the server** (Step 0). The client
invalidation above only refreshes this browser's TanStack cache — both are needed.

Invalidate the narrowest key that changed. Blanket `invalidateQueries({ queryKey: ALL })` after
every mutation refetches lists nobody is looking at, on both meters.

### Form validation

Reuse the Zod schemas from `src/validations/<feature>-schema.ts` — the same objects the Hono route
validates with. Add a feature-local schema only for fields that exist in the form but not the API
(confirm-password, UI-only toggles).

---

## Step 3b — SEO (public-facing features only)

Skip entirely for dashboard/admin features — those inherit `robots: { index: false }` from the
protected layout and must never enter the sitemap.

If the feature has public pages, follow the `seo` skill (`../seo/SKILL.md`):

- `metadata` on static pages; `generateMetadata` on `[id]`/`[slug]` pages, with a unique title,
  description, and `alternates.canonical`.
- Wrap the shared read in React's `cache()` so `generateMetadata` and the page do not each hit the
  database — otherwise every public detail page costs two queries per request.
- Add the feature's URLs to `app/sitemap.ts`, sourced from a cached, columns-only query.
- Prefer a slug over a UUID in public URLs, and index that column.
- Add JSON-LD if the entity maps to a schema.org type.
- `generateStaticParams` wherever the set of pages is knowable at build time — static output is both
  the best-ranking and the cheapest.

## Step 4 — Register Routes

`src/lib/routes/api-routes.ts`:

```typescript
orders: {
  list: '/orders',
  create: '/orders',
  detail: (id: string) => `/orders/${id}`,
  update: (id: string) => `/orders/${id}`,
},
```

`src/lib/routes/app-routes.ts`:

```typescript
orders: {
  index: '/orders',
  create: '/orders/create',
  details: (id: string) => `/orders/${id}`,
  edit: (id: string) => `/orders/${id}/edit`,
},
```

---

## Step 5 — Register Permissions (if applicable)

`src/lib/permission/permissions.ts`:

```typescript
ORDER_VIEW_LIST: 'order_management.order.view_list',
ORDER_CREATE: 'order_management.order.create',
ORDER_EDIT: 'order_management.order.edit',
ORDER_DELETE: 'order_management.order.delete',
```

The same keys go into `requirePermission(...)` on the Hono routes. A `PermissionGate` in the UI is
cosmetic — the server check is the real one, and it is not optional.

---

## Naming Conventions Reminder

| Thing                  | Convention                 | Example                 |
| ---------------------- | -------------------------- | ----------------------- |
| Directory              | kebab-case                 | `order-items/`          |
| Component files        | kebab-case                 | `order-table.tsx`       |
| Hook files             | kebab-case with `use-`     | `use-order-list.ts`     |
| Server files           | kebab-case                 | `order-repository.ts`   |
| Types/Interfaces       | PascalCase                 | `OrderItem`             |
| Zod schemas            | camelCase + `Schema`       | `orderItemSchema`       |
| Constants              | SCREAMING_SNAKE_CASE       | `ORDER_ITEM_QUERY_KEYS` |
| Service/hook instances | camelCase                  | `orderItemService`      |
| DB table/columns       | snake_case in SQL          | `order_items.order_id`  |
| Cache tags             | `resource:scope`           | `orders:list`           |

---

## UI Reminders

- Add components with `npx shadcn@latest add <component>` — never hand-write a primitive that the
  registry already provides.
- Buttons, menu items and other interactive primitives must show a **pointer cursor**. That comes
  from `"pointer": true` in `components.json` (shadcn `init --pointer`), not from adding
  `cursor-pointer` to each `<Button>`. If a new component lands without it, fix the generated
  component once — see the shadcn skill's styling rules.
- Row actions, clickable table rows, and custom clickable cards are the exception: they need
  `cursor-pointer` plus `role="button"` and keyboard handling.

---

## Checklist Before Handing Off

- [ ] Migration generated, reviewed, and applied; indexes cover every filter/sort column
- [ ] Hono route mounted in the `src/server/api/index.ts` export chain
- [ ] Auth/permission middleware on every non-public route
- [ ] Server service invalidates cache tags on create/update/delete
- [ ] All `[feature]` / `[Feature]` / `[FEATURE]` placeholders replaced
- [ ] API routes registered in `api-routes.ts` and `app-routes.ts`
- [ ] Zod schemas shared between the route validator and the forms — not duplicated
- [ ] Query keys unique; mutation hooks invalidate the right ones
- [ ] Read-only pages are Server Components calling the service directly (no self-fetch)
- [ ] `'use client'` appears only on interactive leaves
- [ ] Buttons/menu items show a pointer cursor (config-level, not per-element classes)
- [ ] Public pages: unique metadata + canonical, sitemap entry, `cache()`-shared data source
- [ ] Dashboard pages: no metadata work, not in the sitemap

Cost review:

- [ ] No `refetchInterval` anywhere; `refetchOnWindowFocus` off
- [ ] `staleTime` set per query from real staleness tolerance (reference data: 30–60 min)
- [ ] Client tables seeded with server `initialData` where the first page is server-rendered
- [ ] Mutations invalidate the narrowest matching query key, not everything
- [ ] Cursor pagination used unless the UI genuinely displays a total count
- [ ] No new cron, scheduled job, or always-on dependency introduced
- [ ] `pnpm tsc --noEmit` and `pnpm lint` clean
