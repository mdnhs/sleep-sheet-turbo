# Structured Data (JSON-LD)

Machine-readable description of what a page *is*. Drives rich results — star ratings, breadcrumbs,
FAQ accordions, article bylines. No library needed: it is a `<script>` tag with a JSON object.

Type definitions are worth the one dev dependency:

```bash
pnpm add -D schema-dts
```

---

## Rendering pattern

Server Component, rendered inside the page. Sanitize before injecting — the content is data from
the database, and `</script>` inside a string breaks out of the tag:

```tsx
// src/components/seo/json-ld.tsx
import type { Thing, WithContext } from 'schema-dts';

export function JsonLd<T extends Thing>({ schema }: { schema: WithContext<T> }) {
  return (
    <script
      type='application/ld+json'
      // JSON.stringify escapes quotes; replacing "<" blocks tag-breaking payloads.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  );
}
```

Use it in the page:

```tsx
export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug); // cache()d — shared with generateMetadata
  if (!post) notFound();

  return (
    <>
      <JsonLd<Article>
        schema={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.excerpt,
          image: [post.ogImageUrl],
          datePublished: post.publishedAt.toISOString(),
          dateModified: post.updatedAt.toISOString(),
          author: { '@type': 'Person', name: post.authorName },
          publisher: {
            '@type': 'Organization',
            name: 'Acme',
            logo: { '@type': 'ImageObject', url: `${APP_URL}/logo.png` },
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `${APP_URL}/blog/${post.slug}` },
        }}
      />
      <Article post={post} />
    </>
  );
}
```

Never fetch extra data just for JSON-LD — reuse what the page already loaded.

---

## Which type to use

| Page                     | Type(s)                                       |
| ------------------------ | --------------------------------------------- |
| Home / all pages         | `Organization` + `WebSite`                    |
| Blog post, news, guide   | `Article` / `BlogPosting` / `NewsArticle`     |
| Product page             | `Product` + `Offer` (+ `AggregateRating`)     |
| Pricing / plans          | `Product` + `Offer`, or `Service`             |
| FAQ section              | `FAQPage`                                     |
| How-to / tutorial        | `HowTo`                                       |
| Any nested page          | `BreadcrumbList`                              |
| Local business           | `LocalBusiness` + `PostalAddress`             |
| Job posting              | `JobPosting`                                  |
| Event                    | `Event`                                       |

Multiple types on one page are fine — emit separate `<script>` tags, or one `@graph` array.

---

## Site-wide, in the root layout

```tsx
<JsonLd
  schema={{
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${APP_URL}/#organization`,
        name: 'Acme',
        url: APP_URL,
        logo: `${APP_URL}/logo.png`,
        sameAs: ['https://x.com/acme', 'https://www.linkedin.com/company/acme'],
      },
      {
        '@type': 'WebSite',
        '@id': `${APP_URL}/#website`,
        url: APP_URL,
        name: 'Acme',
        publisher: { '@id': `${APP_URL}/#organization` },
      },
    ],
  }}
/>
```

`@id` lets other pages reference these instead of repeating them.

---

## Breadcrumbs

Emit them wherever the UI shows a breadcrumb trail — cheap, and they change how the URL renders in
results:

```tsx
schema={{
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: `${APP_URL}/blog` },
    { '@type': 'ListItem', position: 3, name: post.title, item: `${APP_URL}/blog/${post.slug}` },
  ],
}}
```

---

## Rules

- **Structured data must match what a user sees on the page.** Marking up a rating, price or FAQ
  that is not rendered is a policy violation and gets rich results revoked.
- Absolute URLs everywhere. ISO 8601 dates (`toISOString()`).
- Never mark up content behind a login.
- Fill the required properties for the type or the result is simply ignored — check the Google
  documentation for the specific type before shipping.

---

## Validation

- Google Rich Results Test — the authority on whether it is *eligible*.
- schema.org validator — catches malformed vocabulary.
- Search Console → Enhancements — shows what Google actually parsed after crawling.

Validate before shipping. Malformed JSON-LD fails silently: no error, no rich result.
