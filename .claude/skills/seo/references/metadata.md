# Metadata

App Router Metadata API only. No `next-seo`, no `<Head>` — both are Pages Router artifacts.

`metadata` and `generateMetadata` are **Server Component exports**. They do not work in a file
marked `'use client'`; move the metadata to the parent Server Component page or layout.

---

## Root layout — set once

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  // Required. Without it, relative OG/canonical URLs resolve against localhost in production.
  metadataBase: new URL(APP_URL),

  title: {
    default: 'Acme — Short value proposition',
    template: '%s | Acme', // child pages set only their own part
  },
  description: 'One sentence, 140–160 characters, written for a human deciding whether to click.',
  applicationName: 'Acme',
  authors: [{ name: 'Acme' }],
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  formatDetection: { email: false, address: false, telephone: false },

  alternates: { canonical: '/' },

  openGraph: {
    type: 'website',
    siteName: 'Acme',
    locale: 'en_IE',
    url: '/',
    title: 'Acme — Short value proposition',
    description: 'Same description, or a sharper one written for social.',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Acme' }],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Acme — Short value proposition',
    description: 'Same description.',
    images: ['/opengraph-image.png'],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },

  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
};
```

`viewport` and `themeColor` are a **separate export**, not part of `metadata`:

```tsx
import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};
```

---

## Static page metadata

```tsx
// src/app/(marketing)/pricing/page.tsx
export const metadata: Metadata = {
  title: 'Pricing', // renders as "Pricing | Acme" via the template
  description: 'Plans and pricing for Acme. Start free, upgrade when you need to.',
  alternates: { canonical: '/pricing' },
};
```

Rules:

- **Title**: 50–60 characters including the template suffix. Unique per page. Lead with the
  distinguishing word, not the brand.
- **Description**: 140–160 characters. It is not a ranking factor but it is the click decision.
  Never leave it inherited across many pages — duplicates get rewritten by Google.
- **Canonical**: always. Relative paths resolve against `metadataBase`.

---

## Dynamic metadata — `generateMetadata`

The data problem first: `generateMetadata` and the page component both need the record, and they run
as two separate calls. Without memoization that is **two database round trips per request** — two
wakes, double duration. React's `cache()` dedupes them within a request:

```typescript
// src/server/services/post-service.ts
import { cache } from 'react';
import { postRepository } from '@/server/repositories/post-repository';

// Same argument within one request → executed once.
export const getPostBySlug = cache((slug: string) => postRepository.bySlug(slug));
```

Layer it with `'use cache'` for cross-request caching (see
`../../project-architect/references/caching.md`): `cache()` dedupes *within* a request,
`'use cache'` caches *between* requests. Public content wants both.

```tsx
// src/app/(marketing)/blog/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPostBySlug } from '@/server/services/post-service';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; // Next.js 16: params is a Promise
  const post = await getPostBySlug(slug);

  // A missing record must not produce a page titled "undefined".
  if (!post) return { title: 'Not found', robots: { index: false, follow: false } };

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      url: `/blog/${post.slug}`,
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.authorName],
      images: [{ url: post.ogImageUrl, width: 1200, height: 630, alt: post.title }],
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.excerpt },
  };
}

// Pre-render at build time: static output, best crawl behaviour, zero per-request cost.
export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug); // cache() hit — no second query
  if (!post) notFound();
  return <Article post={post} />;
}
```

### Inheriting from the parent

```typescript
export async function generateMetadata({ params }, parent: ResolvingMetadata): Promise<Metadata> {
  const previousImages = (await parent).openGraph?.images ?? [];
  return { openGraph: { images: [...previousImages] } };
}
```

Only reach for `parent` when merging arrays. Fields you do not set are inherited already.

---

## Excluding private routes

Put it on the layout so it covers the whole subtree:

```tsx
// src/app/(main)/(protected)/layout.tsx
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};
```

Dashboards, account pages, checkout flows, and anything behind auth. Cheaper too: crawlers stop
requesting pages that cannot be served from cache.

`robots: { index: false }` does not stop a crawl — it stops indexing. To also save crawl budget, add
a `Disallow` in `robots.ts`. Never rely on either for security; they are public hints.

---

## Streaming metadata (Next.js 16)

For dynamically rendered pages, metadata streams in after the shell rather than blocking it, and is
buffered into `<head>` for known bots (`Twitterbot`, `Slackbot`, `Bingbot`, …). Prerendered pages
resolve metadata at build time and never stream.

Consequence: **a slow `generateMetadata` still delays what bots see**. Keep it to cached reads —
never call an external API or an uncached database query there.

---

## Checklist

- [ ] `metadataBase` set in the root layout from `NEXT_PUBLIC_APP_URL`
- [ ] Title template in the root, per-page titles unique and 50–60 chars
- [ ] Descriptions unique, 140–160 chars, no placeholder text
- [ ] `alternates.canonical` on every public page
- [ ] `viewport`/`themeColor` exported separately from `metadata`
- [ ] `generateMetadata` shares its data with the page via `cache()`
- [ ] Missing records return `noindex` metadata, not a broken title
- [ ] Protected route groups set `robots.index: false` at the layout
- [ ] `generateStaticParams` used wherever the set of pages is knowable at build time
