# Open Graph Images

The image that decides whether a shared link gets clicked. 1200×630, under ~1 MB, readable at
thumbnail size.

**Cost first:** an `opengraph-image.tsx` rendered per request is a function invocation with a
Satori/Resvg render inside — one of the most expensive things this app can do, triggered by a
crawler you do not control. Rank the options:

| Approach                                              | Cost                    | Use when                          |
| ----------------------------------------------------- | ----------------------- | --------------------------------- |
| Static file (`opengraph-image.png`)                    | 0 — CDN asset           | Site-wide default, marketing pages |
| Cloudinary text overlay on a template image            | 0 Vercel; Cloudinary CDN | Many per-record images            |
| `ImageResponse` at **build time** (`generateStaticParams`) | 0 per request        | Fixed set of pages                 |
| `ImageResponse` per request                            | Billed every crawl      | Genuinely unbounded, rare          |

---

## 1. Static (default choice)

Drop the file next to the route; Next.js emits the tags automatically:

```text
src/app/
├── opengraph-image.png        # 1200×630 — site-wide default
├── opengraph-image.alt.txt    # alt text
└── (marketing)/pricing/
    └── opengraph-image.png    # overrides for this route
```

Nothing to import, nothing to render, no invocation.

---

## 2. Cloudinary overlay (per-record, still free of Vercel compute)

Compose the title onto a branded template with a URL transformation — see
`../../project-architect/references/cloudinary.md`:

```typescript
export const ogImageFor = (title: string) => {
  const encoded = encodeURIComponent(encodeURIComponent(title)); // double-encode overlay text
  return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_1200,h_630,c_fill/l_text:Inter_64_bold:${encoded},co_white,w_1000,c_fit/fl_layer_apply,g_south_west,x_60,y_80/og-template.png`;
};
```

Then reference it in `generateMetadata`. Cloudinary caches the render at its CDN; Vercel never sees
the request.

---

## 3. `ImageResponse`, generated at build time

```tsx
// src/app/(marketing)/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'; // Next.js 16: next/og, not next/server
import { getPostBySlug, getPublishedSlugs } from '@/server/services/post-service';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Blog post';

// Renders once at build, then served as a static asset.
export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1f2937 100%)',
          padding: 80,
          color: 'white',
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{post?.title ?? 'Acme'}</div>
        <div style={{ fontSize: 28, marginTop: 24, opacity: 0.7 }}>acme.com</div>
      </div>
    ),
    size,
  );
}
```

`ImageResponse` constraints — it is Satori, not a browser:

- **Flexbox only.** No grid, no float. Every element with more than one child needs an explicit
  `display: 'flex'`.
- Inline styles only. No Tailwind classes, no external CSS.
- No `next/image`; plain `<img>` with an absolute URL or a data URI.
- Custom fonts must be fetched and passed in `fonts` — and that fetch costs time on every render, so
  it is another reason to build statically.
- Keep it simple: complex layouts are slow to render and easy to break.

If the page set genuinely cannot be enumerated at build time, add
`export const revalidate = 86400` so the generated image is cached rather than re-rendered per crawl.

---

## Checklist

- [ ] 1200×630, under 1 MB, legible as a thumbnail
- [ ] A site-wide static `opengraph-image.png` exists as the fallback
- [ ] `opengraph-image.alt.txt` or `alt` set
- [ ] Per-record images come from Cloudinary or build-time generation, not per-request rendering
- [ ] `twitter.card: 'summary_large_image'` set where a large image is intended
- [ ] Absolute URLs resolve — `metadataBase` is set
- [ ] Verified with a real scraper (Slack/LinkedIn/X debugger), not just by eye
