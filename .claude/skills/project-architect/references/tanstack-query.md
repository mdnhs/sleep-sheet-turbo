# TanStack Query Reference

## Overview

Client-side server-state management with `@tanstack/react-query`. Provides query caching, deduplication,
background refetching, and mutations. The `QueryProvider` wraps the app with a shared `QueryClient`.

**These defaults are a cost setting, not a preference.** Every client refetch is a billed Vercel
invocation and a Neon wake-up. Refetch-on-focus and intervals are off deliberately — see
`cost-optimization.md`.

## Setup commands to append

```bash
pnpm add @tanstack/react-query
pnpm add @tanstack/react-query-devtools
```

---

## Files to generate

### `src/contexts/QueryProvider.tsx`

```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export interface QueryOptions {
  staleTime?: number;
  gcTime?: number;
  retry?: number;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // raise per-query for slow-moving data
      gcTime: 10 * 60 * 1000,
      retry: 1, // retries multiply cost against a failing backend
      refetchOnMount: false, // cached data is served; mutations invalidate explicitly
      refetchOnWindowFocus: false, // alt-tabbing must never wake Postgres
      refetchOnReconnect: false,
      refetchInterval: false, // NEVER enable without an explicit business reason
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Cost rules

- `refetchInterval` is the most expensive line available in this codebase: N open tabs × the
  interval = a database that never suspends. If data must be live, use a push channel and say so.
- Refresh after writes with `invalidateQueries` — one refetch, on demand, instead of a timer.
- Set `staleTime` from how fast the data actually changes. Reference data (roles, categories,
  settings) belongs at 30–60 minutes, not 5.
- Server-rendered lists can seed the cache via `initialData`, saving the first client fetch
  entirely.

### Update `src/contexts/ProviderWrapper.tsx`

Import `QueryProvider` and wrap the outermost children:

```tsx
import { QueryProvider } from '@/contexts/QueryProvider';

// Wrap as the outermost provider:
<QueryProvider>{/* other providers */}</QueryProvider>;
```
