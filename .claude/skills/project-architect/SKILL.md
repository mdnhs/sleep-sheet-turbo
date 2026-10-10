---
name: project-architect
description: >
  Use this skill whenever the user wants to scaffold, initialize, or set up a new Next.js enterprise
  project from scratch. Triggers include: "start a new Next.js project", "scaffold a new project",
  "set up my Next.js app", "create a new project with this stack", "initialize a new Next.js app",
  "architect a new project", or any request to bootstrap a Next.js application with an enterprise
  structure. Always use this skill before generating any project files — it determines which optional
  features to include and ensures every config file is generated correctly and consistently.
---

# Next.js Project Architect

Interactively scaffolds a complete, production-ready Next.js enterprise project.

**Target architecture** — one Git repo, one Vercel project:

```text
Ireland / EU users
        ↓
   Vercel CDN  ──────────────► Cloudinary (media, global CDN)
        ↓
   Next.js (App Router, RSC)
        +
   Hono.js API  (app/api/[[...route]]/route.ts)
        ↓
   Services → Repositories → Drizzle ORM → Neon serverless driver → Neon Postgres (EU region)
```

**Priority #1 is cost: minimize Vercel spend and Neon compute hours.** Then: performance, low EU
latency, scalability, clean architecture, type safety, security. Where an approach is cleaner but
costs more per request, the cheaper one wins — say so and move on. Use the simplest
production-ready solution first: no Redis, no queues, no microservices, no separate backend, no
cron jobs until there is demonstrated need.

**Read `references/cost-optimization.md` before generating anything.** It is not optional and not a
"later" concern — the expensive mistakes in this stack are architectural and hard to unwind. The
short version:

- Neon bills **time awake**, not queries. Anything periodic (polling, cron, querying health checks,
  an open WebSocket pool, per-request auth lookups) prevents autosuspend and bills like an
  always-on server.
- Vercel bills **invocations × duration**. A page that could be static but renders per request, or a
  Server Component fetching this project's own API, doubles cost for nothing.

> Read `node_modules/next/dist/docs/` for the installed Next.js version before writing framework
> code. APIs in this project's Next.js version may differ from what you remember.
>
> **Next.js 16 specifics that break older habits:**
>
> - `middleware.ts` is now **`proxy.ts`** (one per project, beside `app/`).
> - Cache Components: `'use cache'` + `cacheTag()` + `cacheLife()` replace `unstable_cache`.
>   Enable with `cacheComponents: true` in `next.config.ts`. Never read `cookies()`/`headers()`
>   inside a `'use cache'` scope — pass the values in as arguments.
> - `updateTag()` is Server-Actions-only (read-your-own-writes); `revalidateTag()` is what Hono
>   route handlers use.
> - `params` / `searchParams` in pages are Promises — `await` them.
>
> Verify against the installed docs rather than trusting this list if the version differs.

---

## Phase 1 — Interview

Collect info in three steps — do not combine them into one message.

### Step 1 — Deployment & data

Ask the user for:

- **App URL** (e.g. `https://myapp.com`) — used for `NEXT_PUBLIC_APP_URL`
- **Neon region** (default `aws-eu-west-1` / Dublin for Ireland users)
- **Vercel region** (default `dub1` — must match the Neon region; a cross-region query bills the
  extra latency on both meters)
- **Cloudinary cloud name** (blank if media is not needed yet)

### Step 2 — API config

Ask the user for:

- **API prefix** (default `/api`)
- **API version** (default `/v1`)
- **API base URL** — only if the frontend talks to a *separate external* backend. Default is empty,
  meaning the Hono API in this project, served same-origin.

### Step 3 — Optional features

After the user answers, use the `AskUserQuestion` tool with `type: checkbox` to present these
options. **Backend stack** items are pre-selected by default — this architecture assumes them.

Backend stack (default on):

- Cost Optimization (always on — cost model, Neon autosuspend settings, per-PR review list)
- Hono API (Hono inside Next.js Route Handlers, middleware, error handling, validation)
- Neon + Drizzle (serverless Postgres, schema, repositories, migrations)
- Cloudinary Media (signed direct upload, `f_auto`/`q_auto` delivery, custom next/image loader)
- Caching Strategy (static generation, `'use cache'` + tags, on-demand revalidation)
- Vercel Deployment (region pinning, env validation, security headers, migrations in CI)
- SEO Baseline (root metadata + `metadataBase`, `sitemap.ts`, `robots.ts` with preview guard,
  site-wide JSON-LD, static OG image) — skip only for an app with no public pages at all

Frontend / tooling (ask):

- Translation — Non-route (next-intl, locale without URL change)
- Translation — Route (next-intl, locale in URL via `[locale]` segment)
- Dark/Light Theme Toggle
- TanStack Query
- Case Conversion (`mapSnakeToCamel` / `mapCamelToSnake` + `SnakeToCamelCase` / `CamelCaseKeys` / `SnakeCaseKeys` types)
- API Ecosystem (REST client wrapper for the frontend)
- Module Boundaries (ESLint)
- Typed Search Params (NUQS)
- Permission System (bitfield `compressPermissions`/`decompressPermissions`, `PermissionGate`, `ClientPermissionGate`, `usePermissions` hook, `ROUTE_PERMISSIONS`)

Once the user confirms their selection, read ONLY the reference files for the features they
selected. Do not load reference files for features they skipped.

> Case Conversion is only needed when an **external** backend returns `snake_case`. When the Hono
> API in this project is the only backend, it returns `camelCase` from Drizzle-inferred types and no
> mapping layer is needed — say so rather than generating dead code.

---

## Phase 2 — Generate Core Structure

After the interview, generate all files in this order:

> `create-next-app` and `shadcn init` are assumed done. Do not generate a `package.json`.
>
> **Check `components.json` for `"pointer": true` before anything else.** shadcn must be
> initialised with `--pointer`:
>
> ```bash
> npx shadcn@latest init --pointer
> ```
>
> Tailwind v4 removed the default `cursor: pointer` on `<button>`, so without the flag every
> button in the app shows an arrow cursor. If the project was already initialised without it, fix
> it now — before any components are added — per *Retrofitting pointer cursors* in the shadcn
> skill (`../shadcn/cli.md`): add `"pointer": true` to `components.json`, then add
> `cursor-pointer` to the base class of `buttonVariants` in `components/ui/button.tsx` and to the
> other interactive primitives. Doing it later means editing every component already generated.

### 1. Config files (always generated)

- Read `references/prettier.md` — run its setup commands, then generate all its files (`prettier.config.mjs`, `.prettierignore`, `.lintstagedrc.json`).
- Read `references/husky.md` — run its setup commands, then generate all its files (`.husky/pre-commit`, `.husky/commit-msg`, `.husky/pre-push`, `commitlint.config.mjs`, add `prepare` to `package.json`).
- Run setup commands from each selected feature's reference file, then generate their files.
- `.env.local` — populate with interview answers:

  ```text
  NEXT_PUBLIC_APP_URL=<app-url>
  NEXT_PUBLIC_API_BASE_URL=
  NEXT_PUBLIC_API_PREFIX=<api-prefix>
  NEXT_PUBLIC_API_VERSION=<api-version>
  NEXT_PUBLIC_API_TIMEOUT=30000
  NEXT_PUBLIC_DEBUG_API=false
  MOCK_CLIENT_IP=

  DATABASE_URL=
  DATABASE_URL_UNPOOLED=

  AUTH_SECRET=

  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<cloud-name>
  CLOUDINARY_API_KEY=
  CLOUDINARY_API_SECRET=
  ```

- `.env.example` — same keys, all values empty. Tell the user to fill `DATABASE_URL`,
  `AUTH_SECRET` and the Cloudinary secrets from their own dashboards; never invent values.
- Confirm `.env*.local` is in `.gitignore`.

### 2. Folder skeleton

Create the full directory tree. Generate placeholder `index.ts` or `.gitkeep` files in leaf
directories so the structure is visible in git.

```text
src/
├── app/
│   ├── (marketing)/                    # static, CDN-served
│   │   ├── page.tsx
│   │   └── about/page.tsx
│   ├── sitemap.ts                      # SEO baseline
│   ├── robots.ts
│   ├── opengraph-image.png
│   ├── (auth)/layout.tsx
│   ├── (main)/
│   │   ├── (protected)/
│   │   │   ├── (dashboard_layout)/
│   │   │   │   ├── dashboard/          # .gitkeep
│   │   │   │   └── layout.tsx
│   │   │   └── (global_layout)/layout.tsx
│   │   └── (public)/
│   │       ├── unauthorized/page.tsx
│   │       └── maintenance/page.tsx
│   ├── api/
│   │   └── [[...route]]/route.ts       # Hono mount point
│   └── layout.tsx
├── proxy.ts                            # Next.js 16 (was middleware.ts) — cookies/redirects only
├── server/                             # backend — never imported by client components
│   ├── api/
│   │   ├── index.ts
│   │   └── auth.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── error.ts
│   │   ├── logger.ts
│   │   └── rate-limit.ts
│   ├── lib/
│   │   ├── response.ts
│   │   ├── errors.ts
│   │   └── validator.ts
│   ├── services/
│   ├── repositories/
│   └── db/
│       ├── index.ts
│       ├── schema/index.ts
│       └── migrations/
├── features/                           # empty, features added per-module
├── components/
│   ├── ui/                             # shadcn drops files here
│   ├── seo/                            # JsonLd helper
│   ├── form/
│   ├── layout/
│   │   ├── sidebar/navs/
│   │   └── header/navs/
│   ├── table/
│   └── icons/
├── lib/
│   ├── api-client/
│   ├── cache/tags.ts
│   ├── cloudinary/
│   ├── permission/
│   ├── routes/
│   ├── env.ts
│   ├── utils.ts
│   ├── constants.ts
│   └── font.ts
├── contexts/
├── hooks/
│   └── api/
│       ├── mutation/
│       └── query/
├── types/
│   ├── index.ts
│   └── icons.ts
├── services/
└── validations/                        # Zod schemas shared by API and forms

public/
├── assets/images/
└── fonts/

drizzle.config.ts
vercel.json
```

### 3. Core lib files (always generated)

Read `references/core-lib-files.md` for the full source of each file. Generate them verbatim:

- `src/lib/utils.ts`
- `src/lib/routes/api-routes.ts` — with `auth` group pre-populated, empty shell for features
- `src/lib/routes/app-routes.ts` — same pattern
- `src/types/index.ts` — placeholder with `ServiceResponse`, `PaginationType` only
- `src/contexts/ProviderWrapper.tsx` — minimal shell; optional features add their providers here
- `src/contexts/LoadingOverlayProvider.tsx` — loading overlay context (imported by ProviderWrapper)

### 4. Backend core (generated whenever the backend stack is selected)

- `references/cost-optimization.md` — **read first**. Shapes every choice below.
- `references/hono-api.md` — Hono mount, response envelope, `ApiError`, error/auth/logger/rate-limit
  middleware, shared `zValidator`, `src/server/api/index.ts` with the RPC type export.
- `references/neon-drizzle.md` — `src/server/db/index.ts`, `drizzle.config.ts`, schema conventions,
  repository + service patterns, `db:*` scripts.
- `references/caching.md` — `src/lib/cache/tags.ts`, static-vs-cached decision table, tag
  invalidation, HTTP cache headers.
- `references/cloudinary.md` — signed upload route, delivery helper, custom `next/image` loader.
- `references/vercel-deploy.md` — `vercel.json` region, `src/lib/env.ts`, security headers.
- **SEO baseline** — follow the `seo` skill (`../seo/SKILL.md`): root `metadata` with
  `metadataBase` from `NEXT_PUBLIC_APP_URL`, separate `viewport` export, `app/sitemap.ts`,
  `app/robots.ts` guarded on `VERCEL_ENV`, a static `opengraph-image.png`, the `JsonLd` component
  with site-wide `Organization` + `WebSite`, and `robots: { index: false }` on the protected
  layout. This is the cheapest SEO win available and it is painful to retrofit.

Generate `/api/health` — a static response with **no database call** — and verify it responds
before moving on.

Then tell the user to set, in the Neon console: **suspend timeout = minimum**, **min compute =
0.25 CU**, max 1–2 CU. This single setting is the largest saving available and cannot be done from
code.

### 5. Font (always generated)

Do **not** hardcode a font name. Extract whatever fonts `create-next-app` already placed in the root
layout:

1. **Read** `src/app/layout.tsx`.
2. **Identify** every `next/font` import (`next/font/google` or `next/font/local`) and the
   corresponding `const` declarations in that file.
3. **Create** `src/lib/font.ts` — re-export each font as a named `export const`, preserving the exact
   constructor options verbatim.
4. **Update** `src/app/layout.tsx`:
   - Remove the inline `next/font` import(s) and `const` declaration(s).
   - Add `import { <fontVars> } from '@/lib/font'` in their place.
   - Leave everything else (metadata, className, JSX) untouched.

**Example** — if the root layout contained:

```typescript
import { Geist, Geist_Mono } from 'next/font/google';
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
```

Then `src/lib/font.ts` becomes:

```typescript
import { Geist, Geist_Mono } from 'next/font/google';
export const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
export const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
```

And `src/app/layout.tsx` replaces those lines with:

```typescript
import { geistSans, geistMono } from '@/lib/font';
```

`next/font` is built into Next.js — no install needed. The font variables are applied to `<body>` in
the layout (see translation reference files for layout templates).

---

## Phase 3 — Optional Feature Files

For each enabled feature, read its reference file and generate the additional files it specifies.

| Feature                 | Reference file                        |
| ----------------------- | ------------------------------------- |
| Cost optimization       | `references/cost-optimization.md`     |
| Hono API                | `references/hono-api.md`              |
| Neon + Drizzle          | `references/neon-drizzle.md`          |
| Cloudinary media        | `references/cloudinary.md`            |
| Caching strategy        | `references/caching.md`               |
| Vercel deployment       | `references/vercel-deploy.md`         |
| SEO baseline            | `../seo/SKILL.md` (separate skill)    |
| Translation (non-route) | `references/translation-non-route.md` |
| Translation (route)     | `references/translation-route.md`     |
| Theme toggle            | `references/theme-toggle.md`          |
| TanStack Query          | `references/tanstack-query.md`        |
| Case Conversion         | `references/case-conversion.md`       |
| API ecosystem           | `references/api-ecosystem.md`         |
| Module boundaries       | `references/module-boundaries.md`     |
| NUQS                    | `references/nuqs.md`                  |
| Permission              | `references/permission.md`            |

---

## Architecture Rules (always enforce)

**Cost (overrides the rest when they conflict)**

- Static by default. A route becomes dynamic only when it genuinely must — one stray `cookies()` or
  `headers()` call turns a free CDN hit into a billed function on every visit.
- No polling anywhere: no `refetchInterval`, no `cacheLife('seconds')`, no cron, no uptime monitor
  pointed at a database-backed route. Invalidate by tag on write instead.
- `/api/health` never queries the database.
- Session/permissions come from the signed token, not a per-request user lookup.
- Batch independent queries with `Promise.all`; never a serial await chain.
- Prefer cursor pagination to `COUNT(*)` on hot list routes.
- Vercel Image Optimization off; Cloudinary loader on. That meter stays at zero.
- `proxy.ts` stays tiny: cookie reads and redirects only, never a database call, matcher excluding
  every static path.
- No new always-on infrastructure. Redis, queues and workers are a "no" until measured need.

**Rendering**

- Server Components by default. `'use client'` only for forms, interactive UI, state-heavy
  components, and browser APIs — keep the boundary as small as possible.
- Never make a whole page client-side to reach one interactive widget.
- Server Components call `src/server/services/*` **directly**. They must never `fetch` this
  project's own `/api` route — that is a second function invocation for nothing.

**Layering**

```text
Route handler (Hono) → Service → Repository → Drizzle → Neon
```

- Route files: validate, call a service, wrap in `ok()`. No SQL.
- Services: business rules, authorisation, cache tags. No HTTP objects.
- Repositories: Drizzle only. The single place `db` is imported.
- `src/server/**` is server-only. Client components import from `src/features/**` and `src/lib/**`.

**Data**

- Every list endpoint paginated, `limit` capped in its Zod schema.
- Index every column used in `WHERE` / `ORDER BY` / join.
- Select named columns; no N+1; batch reads with `Promise.all`.
- Cache public reads by tag; invalidate on write. No short polling intervals.

**Types & validation**

- `strict: true` in `tsconfig.json`. No `any` — use Drizzle-inferred and Zod-inferred types.
- Zod schemas in `src/validations/` are shared by API validators and client forms.
- Never trust client input: validate body, query, and params.

**Security**

- Secrets are server-only; only `NEXT_PUBLIC_*` reaches the browser.
- No stack traces in production responses — `onError` returns the generic envelope.
- Authenticated responses: `Cache-Control: private, no-store`.

---

## Naming Conventions (always enforce)

| Item               | Convention                 | Example                 |
| ------------------ | -------------------------- | ----------------------- |
| Files (components) | kebab-case                 | `order-table.tsx`       |
| Files (hooks)      | kebab-case, `use-` prefix  | `use-order-list.ts`     |
| Server files       | kebab-case                 | `order-repository.ts`   |
| Directories        | kebab-case                 | `order-processing/`     |
| React Components   | PascalCase                 | `OrderTable`            |
| Functions/Hooks    | camelCase                  | `useOrderList`          |
| Constants          | SCREAMING_SNAKE_CASE       | `API_ROUTES`            |
| Types/Interfaces   | PascalCase                 | `OrderResponse`         |
| DB tables/columns  | snake_case in SQL          | `orders.user_id`        |
| Drizzle table var  | camelCase plural           | `orders`                |
| Zod schemas        | camelCase + `Schema`       | `orderSchema`           |
| Cache tags         | `resource:scope`           | `orders:list`           |

---

## Final Checklist

- [ ] `.env.local` has real values from interview; `.env.example` has empty values; both gitignored/committed correctly
- [ ] `pnpm build` passes; marketing routes appear as static (`○`) in the build output — treat any
      unintended `ƒ` as a build failure
- [ ] Zero polling: no `refetchInterval`, no cron, no short `revalidate`, no querying health check
- [ ] User told to set Neon autosuspend to minimum and min compute to 0.25 CU
- [ ] Vercel Image Optimization disabled; Cloudinary loader wired up
- [ ] Middleware matcher excludes static assets and public paths
- [ ] Debug logging off in production
- [ ] SEO baseline in place: `metadataBase`, `sitemap.ts`, `robots.ts` (preview-guarded), static OG
      image, protected routes `noindex`
- [ ] `components.json` has `"pointer": true` (shadcn initialised with `--pointer`); buttons show a
      pointer cursor
- [ ] `/api/health` returns the success envelope
- [ ] `drizzle-kit generate` + `migrate` run against the EU Neon branch
- [ ] `vercel.json` region matches the Neon region
- [ ] Every enabled optional feature has its files generated
- [ ] Disabled features have zero files generated (no dead code)
- [ ] No secret is exposed under a `NEXT_PUBLIC_` name
- [ ] Install commands from all selected feature reference files were shown to the user
