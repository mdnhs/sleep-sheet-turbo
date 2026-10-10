# Technical SEO

Canonicals, redirects, internationalisation, crawlability, and the performance signals that feed
ranking. All of it aligns with keeping the app static and cheap.

---

## Canonical URLs

One page, one URL. Duplicates split ranking signals between them.

```typescript
alternates: { canonical: '/blog/my-post' } // resolved against metadataBase
```

Common sources of duplication, and the fix:

| Duplication                                | Fix                                                       |
| ------------------------------------------ | --------------------------------------------------------- |
| `?utm_source=…`, filters, sort params       | Canonical → clean path                                     |
| `/about` vs `/about/`                       | Pick one; `trailingSlash` in `next.config.ts`; redirect other |
| `www` vs apex, `http` vs `https`            | Redirect at the DNS/Vercel level to one host               |
| Paginated lists `/blog?page=2`              | Self-canonical per page; do not canonical everything to page 1 |
| Same content under two routes               | Redirect the loser, or canonical to the winner             |

Filtered/sorted list pages should generally be `noindex, follow` **and** canonical to the clean URL —
an unbounded parameter space burns crawl budget and costs invocations.

---

## Redirects

Permanent moves in `next.config.ts` — handled at the edge, no function invocation:

```typescript
async redirects() {
  return [
    { source: '/old-pricing', destination: '/pricing', permanent: true }, // 308
    { source: '/blog/:slug/amp', destination: '/blog/:slug', permanent: true },
  ];
}
```

- `permanent: true` (308) transfers ranking. Use `false` (307) only for genuinely temporary moves.
- Never chain redirects: A → B → C loses signal and adds latency. Point A straight at C.
- Do **not** implement permanent redirects in `proxy.ts` — that runs a billed invocation for
  something the config layer handles for free.

---

## Internationalisation

hreflang requires each locale to have its own URL, which is why route-based i18n
(`../../project-architect/references/translation-route.md`) is the SEO choice. Cookie-based locale
switching gives every language the same URL — search engines index exactly one of them.

```typescript
alternates: {
  canonical: `/en/blog/${slug}`,
  languages: {
    'en-IE': `/en/blog/${slug}`,
    'ga-IE': `/ga/blog/${slug}`,
    'x-default': `/en/blog/${slug}`,
  },
},
```

Rules: every locale version lists **all** of them including itself; `x-default` points at the
fallback; all locales appear in the sitemap; never auto-redirect a crawler by IP.

---

## Crawlability

- Internal links use `<Link>`. A crawler does not click `onClick` handlers.
- Content that matters must be in the server-rendered HTML — not fetched client-side after mount.
  This is the RSC-first rule from the architecture doing double duty.
- Infinite scroll needs real paginated URLs behind it, or nothing past the first screen is indexed.
- No orphan pages: everything indexable is reachable from a link, not just the sitemap.
- Return real status codes. `notFound()` → 404, not a 200 page saying "not found" — a soft 404
  keeps the URL in the index.
- Keep URLs short, lowercase, hyphenated, and stable. Changing a slug means a redirect forever.

---

## Core Web Vitals

Ranking signals, and mostly the same work as the cost goal:

**LCP (< 2.5s)** — static generation is the single biggest lever. Then: `priority` on the hero
image, correct `sizes`, Cloudinary `f_auto,q_auto`, `next/font` with `display: 'swap'` and
`preload` on the primary face, no render-blocking third-party scripts.

**INP (< 200ms)** — keep the `'use client'` boundary small; heavy tables virtualised; expensive work
off the main thread or debounced (the nuqs debounce also serves this).

**CLS (< 0.1)** — explicit `width`/`height` on every image, reserved space for banners and ads,
`disableTransitionOnChange` on the theme provider, no layout-shifting font swap.

Third-party scripts go through `next/script` with `strategy='afterInteractive'` (or `lazyOnload`),
never a bare `<script>` in the head.

Measure with real data — Search Console → Core Web Vitals uses field data (CrUX); Lighthouse is lab
data and will disagree.

---

## Common failures

| Symptom                              | Cause                                                       |
| ------------------------------------ | ------------------------------------------------------------ |
| Page not indexed                      | `noindex` inherited from a parent layout; blocked in robots.txt; orphan |
| OG image blank when shared            | `metadataBase` missing → relative URL resolved to localhost   |
| Wrong title in results                | Google rewrote a duplicate/vague title                        |
| Preview deployment indexed            | `robots.ts` missing the `VERCEL_ENV` guard                    |
| Rich result never appears             | Invalid JSON-LD, or markup not matching visible content       |
| Metadata missing in view-source       | `generateMetadata` in a `'use client'` file — it is ignored   |
| Duplicate content warnings            | Missing canonicals on parameterised URLs                      |

---

## Launch checklist

- [ ] `NEXT_PUBLIC_APP_URL` correct in production; `metadataBase` derived from it
- [ ] `robots.ts` blocks non-production (`VERCEL_ENV !== 'production'`)
- [ ] `sitemap.xml` reachable, listed in `robots.txt`, submitted in Search Console
- [ ] One host canonical (www vs apex) with a 308 redirect for the other
- [ ] Every public page: unique title, description, canonical
- [ ] Protected routes `noindex`
- [ ] `view-source` on a public page shows real content and complete `<head>` tags
- [ ] Structured data validated in the Rich Results Test
- [ ] Core Web Vitals measured on the deployed site, not locally
- [ ] Public pages appear as `○` (static) in the build output
