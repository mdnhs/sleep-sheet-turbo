# Typed Search Params — NUQS

Replaces raw `useSearchParams` / `router.push` with type-safe, declarative search param
management. Especially useful for table filters, pagination, and any URL-driven state.

> **Cost warning — read before copying anything below.** With `shallow: false`, *every* keystroke in
> a filter input triggers a server round trip: a billed Vercel invocation and a Neon wake-up per
> character. Typing "invoice" = 7 of each. The parsers below are configured with debouncing and
> sensible history defaults to prevent that. Do not remove them.

## Files to generate

### `src/contexts/NuqsProvider.tsx`

```typescript
'use client';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export function NuqsProvider({ children }: { children: React.ReactNode }) {
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
```

### Update `src/contexts/ProviderWrapper.tsx`

Add `NuqsProvider` inside the provider composition, wrapping the children:

```tsx
import { NuqsProvider } from '@/contexts/NuqsProvider';

// Inside ProviderWrapper return:
<NuqsProvider>{children}</NuqsProvider>;
```

### `src/hooks/use-table-search-params.ts`

A reusable hook pattern for paginated table filters:

```typescript
import { debounce, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';

export const tableSearchParamsParsers = {
  page: parseAsInteger.withDefault(1),
  limit: parseAsInteger.withDefault(20),
  search: parseAsString.withDefault(''),
  sortBy: parseAsString.withDefault(''),
  // Enum, not free string: this value reaches an ORDER BY clause.
  sortOrder: parseAsStringLiteral(['asc', 'desc'] as const).withDefault('desc'),
};

export const useTableSearchParams = () =>
  useQueryStates(tableSearchParamsParsers, {
    // 'replace' keeps the back button useful — filter typing should not fill history.
    history: 'replace',
    // shallow: false re-runs the server render on every change. Required only when the
    // page is server-rendered from search params. If the table fetches client-side with
    // TanStack Query, leave this true and let the query key drive the refetch — it is
    // strictly cheaper.
    shallow: false,
    // Without this, one invocation + one DB wake-up per keystroke.
    limitUrlUpdates: debounce(400),
  });
```

Pick one data path per table and stay with it:

| Path                                    | Setting                        | Cost per keystroke              |
| --------------------------------------- | ------------------------------ | -------------------------------- |
| Server-rendered table (RSC reads params) | `shallow: false` + debounce    | 1 invocation per debounced burst |
| Client table (TanStack Query)            | `shallow: true` + debounce     | 0 — URL only; query key refetches |

Debounce the *text* inputs. Selects, page changes and sort toggles are discrete — they can update
immediately (`limitUrlUpdates` applies per-hook, so use a second hook if you need both behaviours).

### Usage pattern in feature table filters

When generating feature list pages that have search/filter/pagination, use NUQS:

```typescript
// features/orders/components/list/order-table-filter.tsx
import { useTableSearchParams } from '@/hooks/use-table-search-params';

export function OrderTableFilter() {
  const [params, setParams] = useTableSearchParams();

  return (
    <Input
      value={params.search}
      // Always reset page when a filter changes, or page 3 of the old filter
      // returns an empty result set.
      onChange={(e) => setParams({ search: e.target.value, page: 1 })}
      placeholder='Search orders...'
    />
  );
}
```

### Server-side parsing (`nuqs/server`)

When a Server Component reads the params, parse them with the **same** parsers instead of hand-rolling
`Number(searchParams.page)`. One definition, no drift between client and server:

```typescript
// src/lib/search-params.ts
import { createSearchParamsCache } from 'nuqs/server';
import { tableSearchParamsParsers } from '@/hooks/use-table-search-params';

export const tableSearchParamsCache = createSearchParamsCache(tableSearchParamsParsers);
```

```tsx
// src/app/(main)/(protected)/(dashboard_layout)/orders/(list)/page.tsx
import { tableSearchParamsCache } from '@/lib/search-params';
import { orderService } from '@/server/services/order-service';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Next.js 16: searchParams is a Promise.
  const { page, limit, search } = await tableSearchParamsCache.parse(searchParams);
  const { rows } = await orderService.list({ page, limit: Math.min(limit, 100), search });
  return <OrderTable initialData={rows} />;
}
```

Clamp `limit` server-side regardless of the parser default — the URL is user input, and
`?limit=100000` is a denial-of-wallet on both meters. The Zod schema on the API route does the same
job for the client path.

### Feature-specific search params

For feature-specific filters beyond the base table params, create per-feature parsers:

```typescript
// features/orders/utils/search-params.ts
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';

export const orderSearchParamsParsers = {
  status: parseAsStringEnum(['pending', 'completed', 'cancelled']).withDefault('pending'),
  customerId: parseAsString.withDefault(''),
};

export const useOrderSearchParams = () =>
  useQueryStates(orderSearchParamsParsers, { history: 'replace', shallow: false });
```

## Setup commands to append

```bash
pnpm add nuqs
# No other setup needed — nuqs works with the NuqsAdapter already configured
```

## Checklist

- [ ] Text inputs debounced via `limitUrlUpdates: debounce(...)`
- [ ] `history: 'replace'` for filters (`'push'` only where back-navigation should undo a filter)
- [ ] `shallow: false` only when the server actually re-renders from the params
- [ ] `sortOrder` / enum params use `parseAsStringLiteral` / `parseAsStringEnum`, never raw strings
- [ ] Any filter change resets `page` to 1
- [ ] `limit` clamped server-side
