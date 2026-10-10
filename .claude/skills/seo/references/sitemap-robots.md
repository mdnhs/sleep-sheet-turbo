# Sitemap & Robots

Both are file conventions in `app/`. **Do not install `next-sitemap`** — it is a Pages Router-era
build script that duplicates what `sitemap.ts` does natively and writes stale files into `public/`.

Both files are Route Handlers under the hood: they are **cached by default**, and become dynamic the
moment they touch a request-time API. A sitemap that queries Neon on every crawler request is a
recurring bill for a file that changes daily at most.

---

## `src/app/sitemap.ts`

```typescript
import type { MetadataRoute } from 'next';
import { getSitemapEntries } from '@/server/services/sitemap-service';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

// Regenerate daily. The crawler hits this often; the data changes rarely.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${APP_URL}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${APP_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${APP_URL}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ];

  // Cached service — one query per revalidation window, not per crawl.
  const posts = await getSitemapEntries();

  return [
    ...staticRoutes,
    ...posts.map((post) => ({
      url: `${APP_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
```

The service behind it selects **only** what the sitemap needs:

```typescript
// src/server/services/sitemap-service.ts
import { cacheLife, cacheTag } from 'next/cache';

export async function getSitemapEntries() {
  'use cache';
  cacheTag('sitemap');
  cacheLife('days');
  // slug + updatedAt only — never the full row
  return db
    .select({ slug: posts.slug, updatedAt: posts.updatedAt })
    .from(posts)
    .where(eq(posts.status, 'published'))
    .orderBy(desc(posts.updatedAt))
    .limit(50_000);
}
```

Rules:

- **Public, indexable URLs only.** No dashboard, no auth pages, no filtered/search URLs, no
  `noindex` pages. A sitemap full of non-indexable URLs wastes crawl budget and signals low quality.
- Absolute URLs, matching the canonical exactly — same host, same trailing-slash style.
- `lastModified` from real data. Faking it with `new Date()` on dynamic entries teaches crawlers to
  ignore it.
- `priority`/`changeFrequency` are hints Google largely ignores. Correct `lastModified` matters more.
- Index it in `robots.ts`, and submit it once in Search Console.

### Over 50,000 URLs

Google's limit per sitemap is 50,000 URLs / 50 MB. Split with `generateSitemaps`:

```typescript
export async function generateSitemaps() {
  const total = await getPublishedCount(); // cached
  return Array.from({ length: Math.ceil(total / 40_000) }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const rows = await getSitemapPage({ offset: id * 40_000, limit: 40_000 });
  return rows.map(/* … */);
}
```

Produces `/sitemap/0.xml`, `/sitemap/1.xml`, … Use **cursor**-based slicing if the table is large
enough that deep `OFFSET` scans get expensive.

---

## `src/app/robots.ts`

```typescript
import type { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export default function robots(): MetadataRoute.Robots {
  // Keep preview and staging deployments out of the index entirely.
  const isProduction = process.env.VERCEL_ENV === 'production';

  if (!isProduction) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/login', '/unauthorized', '/maintenance', '/*?*'],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
```

Notes:

- The preview guard matters: an indexed `*.vercel.app` preview competes with the real domain.
- `Disallow: /*?*` blocks crawling of every query-string URL — filter and pagination combinations
  are an unbounded crawl space and a direct cost multiplier. Only add it if no public page depends
  on search params for its content; otherwise disallow the specific parameters.
- Blocking `/api/` saves invocations on routes a crawler has no use for.
- `robots.txt` controls **crawling**, not indexing; a blocked URL can still be indexed from external
  links. To keep something out of results use `robots: { index: false }` metadata — and to do both,
  do not block the URL, or the crawler never sees the noindex tag.
- Neither is a security boundary. Anything private is protected by auth, full stop.

---

## Verification

```bash
curl -s https://<host>/robots.txt
curl -s https://<host>/sitemap.xml | head -40
```

- Google Search Console → Sitemaps: submit once, then watch for parse errors.
- Search Console → Pages: check the "Excluded" reasons after the first crawl.
- Confirm both routes show as static/ISR in the build output, not dynamic.
