# Vercel Deployment (Ireland / EU)

One Git repository → one Vercel project → Next.js frontend + Hono API. No separate backend, no
Docker, no always-running server.

**Cost is priority #1.** Vercel bills invocations × (active CPU + provisioned memory × wall-clock),
plus separate meters for image optimization, bandwidth, and observability. Configure to keep every
one of those near zero — see `cost-optimization.md`.

---

## Region

Users are in Ireland and the EU, and the database is in an EU Neon region. Pin function execution to
Dublin so the function↔database hop stays intra-region.

`vercel.json`:

```json
{
  "regions": ["dub1"],
  "framework": "nextjs"
}
```

- `dub1` = Dublin. `arn1` (Stockholm) or `fra1` (Frankfurt) are alternatives — the rule is
  **same region as Neon**, since a cross-region query adds tens of milliseconds to every call.
- Static assets are served from the global CDN regardless of this setting.
- Fluid Compute (default on new projects) keeps instances warm and lets concurrent requests share
  one instance, so time spent awaiting the database is amortised instead of billed per invocation.
  Leave it on — disabling it raises the bill and adds cold starts.

---

## Runtime

- Route Handlers hosting Hono: `export const runtime = 'nodejs'`.
- Edge runtime only for routes that touch neither the database nor Node-only libraries
  (e.g. a redirect or a geo check in `proxy.ts`). Edge looks cheaper per invocation, but
  running it far from the EU database makes every query slower — and duration is billed.
- Keep the function memory tier at the smallest that fits: memory multiplies the duration charge.
- Import narrowly (`import { format } from 'date-fns/format'`, not the whole package). Fat bundles
  lengthen cold starts, and cold starts are billed time.
- **`proxy.ts` (Next.js 16 — this replaced `middleware.ts`)** runs on every matched request,
  including ones that would otherwise be free CDN hits, and is billed. Keep the matcher narrow,
  keep it to cookie/redirect logic, and **never** query the database from it. One `proxy.ts` per
  project, at the same level as `app/` (inside `src/` if used).

```typescript
// src/proxy.ts  (Next.js 16; was middleware.ts in v15)
// Exclude everything static: each excluded path is an invocation not billed.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|assets|images|fonts|api/health).*)',
  ],
};
```

Narrow this further if only a few route groups need auth checks — matching `/dashboard/:path*`
explicitly beats a negative lookahead over the whole site.

---

## Cost-critical project settings

| Setting                        | Value                    | Why                                                     |
| ------------------------------ | ------------------------ | ------------------------------------------------------- |
| Fluid Compute                  | **on**                   | Shares instances; idle await time is not billed per call |
| Image Optimization             | **off / custom loader**  | Cloudinary transforms instead — see `cloudinary.md`      |
| Function memory                | smallest that fits       | Memory × duration is the charge                          |
| Cron jobs                      | **none by default**      | Every scheduled run is billed and wakes Neon             |
| Deployment protection / previews | prune stale previews   | Preview deploys and Neon preview branches both bill      |
| Observability / log drains     | sampled in production    | Log volume is its own meter                              |
| Skew protection / analytics    | enable only if used      | Unused paid add-ons are pure loss                        |

**No cron jobs unless the business requires them.** A "cache warmer" or uptime ping costs on both
meters every run and usually exceeds the misses it prevents. If a health check is monitored
externally, point it at `/api/health`, which returns a static object and never queries.

---

## Environment variables

Only `NEXT_PUBLIC_*` reaches the browser. Everything else stays server-side.

`.env.example` (committed, no values):

```text
# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_API_PREFIX=
NEXT_PUBLIC_API_VERSION=
NEXT_PUBLIC_API_TIMEOUT=
NEXT_PUBLIC_DEBUG_API=

# Database (server only)
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Auth (server only)
AUTH_SECRET=

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

`NEXT_PUBLIC_API_BASE_URL` is **empty in production** — the API is same-origin, so requests go to
`/api/v1/...` and skip a DNS lookup and a CORS preflight.

Set each variable in the Vercel dashboard per environment (Production / Preview / Development).
Rotate `AUTH_SECRET` and the Cloudinary secret out of any repo they ever touched.

---

## Environment validation — `src/lib/env.ts`

Fail at build time, not at 3am in a handler.

```typescript
import { z } from 'zod';

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1),
});

// Client vars must be referenced literally — Next.js inlines them at build time.
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
});

export const serverEnv = () => {
  if (typeof window !== 'undefined') throw new Error('serverEnv() called in the browser');
  return serverSchema.parse(process.env);
};
```

---

## Security headers — `next.config.ts`

```typescript
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Next.js 16 Cache Components — enables `'use cache'` / cacheTag / cacheLife.
  cacheComponents: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```

Hono adds its own via `secureHeaders()` on the API surface.

---

## Migrations in CI

Migrations do **not** run inside a request. Run them from the build/deploy step or a separate job,
against `DATABASE_URL_UNPOOLED`:

```json
{
  "scripts": {
    "build": "next build",
    "db:deploy": "drizzle-kit migrate"
  }
}
```

Use a Neon branch for preview deployments so previews never write to production data.

---

## Deployment checklist

- [ ] `vercel.json` region matches the Neon region
- [ ] Every server secret set in Vercel, none of them `NEXT_PUBLIC_`
- [ ] `.env.example` committed with empty values; `.env.local` gitignored
- [ ] `pnpm build` passes locally with `NODE_ENV=production`
- [ ] Migrations applied before the deploy that depends on them
- [ ] `/api/health` returns 200 after deploy — and touches no database
- [ ] Marketing routes show as static in the build output (`○`), not dynamic (`ƒ`)
- [ ] Fluid Compute on; Vercel Image Optimization off (Cloudinary loader in place)
- [ ] `proxy.ts` matcher excludes static assets and public paths; no DB access in it
- [ ] No cron jobs, no uptime monitor hitting a database-backed route
- [ ] `DEBUG_API` / `NEXT_PUBLIC_DEBUG_API` are `false` in production
- [ ] Neon autosuspend at minimum, min compute 0.25 CU, stale preview branches deleted
- [ ] First week after launch: check Vercel Usage per route and the Neon compute-hour graph
