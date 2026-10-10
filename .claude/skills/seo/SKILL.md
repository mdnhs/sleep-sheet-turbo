---
name: seo
description: >
  Use this skill for anything affecting how the site appears in search results or when shared.
  Triggers include: "add metadata", "set the page title / description", "add Open Graph tags",
  "the OG image is wrong", "add a sitemap", "robots.txt", "canonical URL", "add structured data /
  JSON-LD / rich results", "this page isn't indexed", "improve SEO", "hreflang", "noindex the
  dashboard", "Core Web Vitals", or any new public-facing page. Always consult this skill before
  writing `metadata` / `generateMetadata`, `sitemap.ts`, `robots.ts`, or JSON-LD — do not improvise
  the tags.
---

# SEO

Search visibility for the Next.js + Hono + Neon stack. Built on the App Router Metadata API — no
`next-seo`, no `next-sitemap`, no `react-helmet`. Those are Pages Router-era packages and add a
dependency for what the framework already does.

**SEO and the cost goal point the same way.** Crawlers hit many URLs and ignore your cache
assumptions; a statically generated page is both the best-ranking and the cheapest to serve. Every
recommendation here favours static/ISR output. See `../project-architect/references/cost-optimization.md`.

> Next.js 16 in this project. `params`/`searchParams` are Promises; `ImageResponse` comes from
> `next/og`; metadata streams for dynamic pages but is buffered for known bots. Verify against
> `node_modules/next/dist/docs/` if the version differs.

---

## Before You Start

1. **Is this page public?** Dashboard and auth pages get `robots: { index: false, follow: false }`
   and stay out of the sitemap. Do not write marketing metadata for them.
2. **Is it statically generated?** If a public page renders dynamically, fix that first — it is
   worse for crawl budget, worse for LCP, and billed per request.
3. **Does it have one canonical URL?** Filters, sorts and pagination in search params usually need a
   canonical pointing at the clean URL.
4. **Is there a real entity behind it?** (article, product, organisation, FAQ) → structured data.
5. **Multilingual?** Locale routing must be in the URL for hreflang to work — see
   `../project-architect/references/translation-route.md`.

---

## Reference files

| Topic                                         | File                              |
| --------------------------------------------- | --------------------------------- |
| Titles, descriptions, OG/Twitter, canonicals   | `references/metadata.md`          |
| `sitemap.ts`, `robots.ts`, indexing control    | `references/sitemap-robots.md`    |
| OG images (static and generated)               | `references/og-images.md`         |
| JSON-LD / rich results                         | `references/structured-data.md`   |
| Canonicals, redirects, hreflang, Core Web Vitals | `references/technical-seo.md`    |

Read only the ones the task needs.

---

## Non-negotiables

- `metadataBase` set once in the root layout, from `NEXT_PUBLIC_APP_URL`. Without it every relative
  OG image URL resolves to `localhost` in production.
- Every public page has a unique `title` and `description`. Duplicates across pages actively hurt.
- Every public page declares `alternates.canonical`.
- Every non-public route tree sets `robots: { index: false }` in its layout.
- Data fetched in both `generateMetadata` and the page is wrapped in React's `cache()` — otherwise
  the same query runs twice per request, doubling the Neon wake and the function duration.
- `sitemap.ts` and `robots.ts` are cached, never per-request database reads.
- One `<h1>` per page, describing the page — not the site name.
- Images have `alt`, explicit dimensions, and `sizes`; the LCP image gets `priority`.

---

## Checklist for any new public page

- [ ] Unique title + description; title template applies from the layout
- [ ] `alternates.canonical` set
- [ ] OG + Twitter tags resolve (inherited from root unless overridden)
- [ ] Page is static or ISR — check for `○` in the build output
- [ ] Added to `sitemap.ts` (dynamic entries come from a cached query)
- [ ] Structured data if a recognised entity type applies, validated
- [ ] Metadata data source shared with the page via `cache()`
- [ ] `<h1>` present and unique; heading order sane
- [ ] Internal links use `<Link>`; no orphan pages
