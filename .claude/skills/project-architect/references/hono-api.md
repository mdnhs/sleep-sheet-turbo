# Hono API (inside Next.js)

The backend lives **inside the same Next.js project**. No separate server, no Docker, one Vercel project.
Hono mounts on a single catch-all Route Handler and owns every `/api/*` path.

**Every request here is a billed Vercel invocation, and every query wakes Neon.** Cost is priority
#1 — read `cost-optimization.md`. Two rules shape everything below: a Server Component must never
call these routes over HTTP (import the service instead), and no route may run on a timer.

```text
Next.js App Router
├── Frontend (RSC + client components)
└── app/api/[[...route]]/route.ts  →  Hono app  →  services  →  repositories  →  Drizzle  →  Neon
```

## Setup commands to append

```bash
pnpm add hono @hono/zod-validator zod
```

---

## Folder layout

```text
src/server/
├── api/
│   ├── index.ts          # root Hono app, mounts every route module
│   ├── auth.ts
│   └── <resource>.ts     # one file per resource — added by the new-feature skill
├── middleware/
│   ├── auth.ts
│   ├── error.ts
│   ├── logger.ts
│   └── rate-limit.ts
├── lib/
│   ├── response.ts       # success/failure envelope helpers
│   └── errors.ts         # ApiError + error codes
├── services/             # business logic, cache orchestration
├── repositories/         # Drizzle queries only
└── db/                   # see neon-drizzle.md
```

---

## `src/app/api/[[...route]]/route.ts`

```typescript
import { handle } from 'hono/vercel';
import { api } from '@/server/api';

// Node runtime: needed for the Neon serverless driver's connection caching and for
// crypto/auth libs. Edge is only worth it for routes that never touch the DB.
export const runtime = 'nodejs';
// Never let a mutation-capable handler be statically optimised.
export const dynamic = 'force-dynamic';

export const GET = handle(api);
export const POST = handle(api);
export const PUT = handle(api);
export const PATCH = handle(api);
export const DELETE = handle(api);
export const OPTIONS = handle(api);
```

---

## `src/server/lib/errors.ts`

```typescript
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number = 400,
    readonly causes?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(ERROR_CODES.UNAUTHORIZED, message, 401);
  }
  static forbidden(message = 'Forbidden') {
    return new ApiError(ERROR_CODES.FORBIDDEN, message, 403);
  }
  static notFound(message = 'Not found') {
    return new ApiError(ERROR_CODES.NOT_FOUND, message, 404);
  }
  static conflict(message = 'Conflict') {
    return new ApiError(ERROR_CODES.CONFLICT, message, 409);
  }
}
```

---

## `src/server/lib/response.ts`

Every response — success or failure — uses one envelope. The frontend service layer depends on this shape.

```typescript
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ERROR_CODES, type ErrorCode } from './errors';

export interface PaginationMeta {
  total: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface SuccessBody<T> {
  success: true;
  data: T;
  pagination?: PaginationMeta;
}

export interface ErrorBody {
  success: false;
  error: { code: ErrorCode; message: string; causes?: Record<string, string[]> };
}

export const ok = <T>(c: Context, data: T, init?: { status?: ContentfulStatusCode; pagination?: PaginationMeta }) =>
  c.json<SuccessBody<T>>(
    { success: true, data, ...(init?.pagination ? { pagination: init.pagination } : {}) },
    init?.status ?? 200,
  );

export const fail = (
  c: Context,
  code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
  message = 'Something went wrong',
  status: ContentfulStatusCode = 500,
  causes?: Record<string, string[]>,
) => c.json<ErrorBody>({ success: false, error: { code, message, ...(causes ? { causes } : {}) } }, status);

export const buildPagination = (total: number, page: number, limit: number): PaginationMeta => {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    total,
    totalPages,
    currentPage: page,
    limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
```

---

## `src/server/middleware/error.ts`

Centralised. Never leaks a stack trace to a production client.

```typescript
import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ApiError, ERROR_CODES } from '@/server/lib/errors';
import { fail } from '@/server/lib/response';

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    return fail(c, err.code, err.message, err.status as never, err.causes);
  }

  if (err instanceof HTTPException) {
    return fail(c, ERROR_CODES.INTERNAL_ERROR, err.message, err.status as never);
  }

  // Unknown error: log the real thing server-side, return a generic message.
  console.error('[api] unhandled error', {
    path: c.req.path,
    method: c.req.method,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return fail(c, ERROR_CODES.INTERNAL_ERROR, 'Something went wrong', 500);
};

export const onNotFound: NotFoundHandler = (c) => fail(c, ERROR_CODES.NOT_FOUND, 'Route not found', 404);
```

---

## `src/server/middleware/auth.ts`

```typescript
import { createMiddleware } from 'hono/factory';
import { ApiError } from '@/server/lib/errors';

export interface AuthUser {
  id: string;
  email: string;
  permissions: string[];
}

export type AuthEnv = { Variables: { user: AuthUser } };

// TODO: implement — verify the signed session cookie / JWT and read the claims.
//
// COST-CRITICAL: resolve the user from the token payload alone. Do NOT query the users
// table here. This middleware runs on every authenticated request, so a lookup turns each
// page view into a Neon wake-up and prevents the endpoint from ever suspending.
// Put id, email and permission bits in the signed token; re-issue it when they change
// (see the session-invalidation pattern) and hit the database only on login.
const resolveUser = async (_c: Parameters<Parameters<typeof createMiddleware>[0]>[0]): Promise<AuthUser | null> => null;

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const user = await resolveUser(c);
  if (!user) throw ApiError.unauthorized();
  c.set('user', user);
  await next();
});

export const requirePermission = (permission: string) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get('user');
    if (!user?.permissions.includes(permission)) throw ApiError.forbidden();
    await next();
  });
```

---

## `src/server/middleware/logger.ts`

```typescript
import { createMiddleware } from 'hono/factory';

const isDebug = () => process.env.NODE_ENV === 'development' || process.env.DEBUG_API === 'true';

export const requestLogger = createMiddleware(async (c, next) => {
  if (!isDebug()) return next();
  const start = Date.now();
  await next();
  console.log(`[api] ${c.req.method} ${c.req.path} → ${c.res.status} (${Date.now() - start}ms)`);
});
```

---

## `src/server/middleware/rate-limit.ts`

In-memory, per-instance. Good enough to blunt abuse of auth/mutation routes without adding Redis.
Swap for Upstash only when there is a demonstrated need.

```typescript
import { createMiddleware } from 'hono/factory';
import { ApiError, ERROR_CODES } from '@/server/lib/errors';

const buckets = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (limit = 20, windowMs = 60_000) =>
  createMiddleware(async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? c.req.header('x-real-ip') ?? 'unknown';
    const key = `${c.req.path}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
    } else if (++bucket.count > limit) {
      throw new ApiError(ERROR_CODES.RATE_LIMITED, 'Too many requests', 429);
    }

    await next();
  });
```

---

## `src/server/api/index.ts`

```typescript
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { onError, onNotFound } from '@/server/middleware/error';
import { requestLogger } from '@/server/middleware/logger';
import { auth } from './auth';

const app = new Hono().basePath('/api');

app.use('*', secureHeaders());
app.use('*', requestLogger);

app.onError(onError);
app.notFound(onNotFound);

export const api = app
  // Static by design: no database, no session lookup. An external monitor pinging a
  // querying health check keeps the Neon endpoint awake 24/7 and bills full compute.
  .get('/health', (c) => {
    c.header('Cache-Control', 'public, s-maxage=60');
    return c.json({ success: true, data: { status: 'ok' } });
  })
  .route('/auth', auth);
// TODO: mount feature route modules here as they are scaffolded
// .route('/orders', orders)

// RPC type export — gives the frontend end-to-end types via hono/client.
export type ApiType = typeof api;
```

> Keep the chained `.route()` calls on one `export const` expression. Hono's RPC types only
> flow through the chain — reassigning to a variable between calls loses them.

---

## Resource route module pattern — `src/server/api/<resource>.ts`

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/server/lib/validator';
import { requireAuth, requirePermission, type AuthEnv } from '@/server/middleware/auth';
import { rateLimit } from '@/server/middleware/rate-limit';
import { ok, buildPagination } from '@/server/lib/response';
import { ApiError } from '@/server/lib/errors';
import { orderService } from '@/server/services/order-service';
import { createOrderSchema, updateOrderSchema, orderListQuerySchema } from '@/validations/order-schema';

const idParamSchema = z.object({ id: z.string().uuid() });

export const orders = new Hono<AuthEnv>()
  .use('*', requireAuth)

  .get('/', requirePermission('order_management.order.view_list'), zValidator('query', orderListQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const { rows, total } = await orderService.list(query);
    return ok(c, rows, { pagination: buildPagination(total, query.page, query.limit) });
  })

  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const order = await orderService.byId(id);
    if (!order) throw ApiError.notFound('Order not found');
    return ok(c, order);
  })

  .post('/', rateLimit(30), zValidator('json', createOrderSchema), async (c) => {
    const created = await orderService.create(c.req.valid('json'), c.get('user').id);
    return ok(c, created, { status: 201 });
  })

  .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateOrderSchema), async (c) => {
    const updated = await orderService.update(c.req.valid('param').id, c.req.valid('json'));
    return ok(c, updated);
  })

  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    await orderService.remove(c.req.valid('param').id);
    return ok(c, null);
  });
```

Cost rules for every route module:

- Public GETs set `Cache-Control: public, s-maxage=…, stale-while-revalidate=…` so the Vercel CDN
  answers repeats without an invocation. Authenticated routes set `private, no-store`.
- Reads that can be shared go through a cached service (`'use cache'` + `cacheTag`) so a cache hit
  never wakes the database.
- Batch independent queries inside a handler with `Promise.all`; a serial chain bills its total
  latency on both meters.
- Prefer cursor pagination over `COUNT(*)` on hot list routes (see `neon-drizzle.md`).

Rules:

- Validate **body, query and params** with `zValidator`. Never read `c.req.query()` raw.
- Handlers stay thin: validate → call service → wrap in `ok()`. No Drizzle calls in a route file.
- Throw `ApiError` instead of hand-building error responses; `onError` formats them.
- Zod schemas live in `src/validations/` and are shared with the client forms.

---

## Zod validation error shape

Make `zValidator` failures use the same envelope as everything else. Add this hook once and reuse:

```typescript
// src/server/lib/validator.ts
import { zValidator as zv } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';
import { ApiError, ERROR_CODES } from '@/server/lib/errors';

export const zValidator = <T extends ZodSchema>(target: 'json' | 'query' | 'param' | 'form', schema: T) =>
  zv(target, schema, (result) => {
    if (!result.success) {
      const causes: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        (causes[key] ??= []).push(issue.message);
      }
      throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 'Validation failed', 422, causes);
    }
  });
```

Import `zValidator` from `@/server/lib/validator` in route modules, not from `@hono/zod-validator` directly.

---

## Frontend consumption

Two supported paths — pick one per project and stay consistent:

1. **REST client** (default, works with the existing api-ecosystem client): base URL is same-origin,
   so `NEXT_PUBLIC_API_BASE_URL` is empty in production and requests go to `/api/...`.
2. **Hono RPC** (`hono/client`) for full end-to-end type inference:

```typescript
// src/lib/api-client/rpc.ts
import { hc } from 'hono/client';
import type { ApiType } from '@/server/api';

export const rpc = hc<ApiType>(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
```

**Server Components must not `fetch` their own API over HTTP.** That costs a second function
invocation and a network hop. Call the service layer directly:

```tsx
import { orderService } from '@/server/services/order-service';

export default async function OrdersPage() {
  const { rows } = await orderService.list({ page: 1, limit: 20 });
  return <OrderTable initialData={rows} />;
}
```

The Hono API exists for client components, mutations, and external consumers.

Calling `/api` from a Server Component bills **two** invocations per page view and adds a full
network round trip — it is the most common accidental cost regression in this architecture.
