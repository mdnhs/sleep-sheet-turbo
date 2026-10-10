import { revalidatePath, revalidateTag } from "next/cache";
import { purgeCdn } from "@/lib/cdn-purge";

/**
 * Cache invalidation for the two editorial content types.
 *
 * Blog posts and testimonials were the only cached reads nothing invalidated
 * on write, so their `revalidate` timer was the sole path to fresh content —
 * and it had to be kept short (30 minutes) for an edit to appear in any
 * reasonable time. That meant up to 96 lazy revalidations a day between them,
 * each one a chance to wake a sleeping Neon compute that bills a five-minute
 * minimum per wake, for content that changes a few times a month.
 *
 * With the writes invalidating their own tags, the timer becomes what it is
 * everywhere else in the app: a fallback for changes that bypass these routes,
 * free to sit at 24 hours.
 *
 * `{ expire: 0 }` rather than a named cacheLife profile, for the reason
 * lib/meta-catalog/cache.ts sets out: these run inside Hono route handlers,
 * and a named profile marks the entry stale on its own schedule while
 * expire 0 drops it now — which is what an edit needs.
 */

function invalidate(tag: string): void {
  try {
    revalidateTag(tag, { expire: 0 });
  } catch {
    /* Ignore if invoked outside the Next.js request lifecycle */
  }
  purgeCdn();
}

/** Call after any write to `posts`. */
export function invalidateBlog(): void {
  invalidate("blog");
  // The blog sitemap is a route handler cached by its own `revalidate` timer,
  // not by the "blog" tag — without this a newly published post stayed out of
  // the sitemap Google reads for up to a day.
  try {
    revalidatePath("/sitemap-blogs.xml");
  } catch {
    /* Ignore if invoked outside the Next.js request lifecycle */
  }
}

/** Call after any write to `Testimonial`. */
export function invalidateTestimonials(): void {
  invalidate("testimonials");
}
