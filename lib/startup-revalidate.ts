// Every page, sitemap and feed prerendered by `next build` was rendered
// without a database (the image is built in GitHub Actions — see
// lib/build-phase.ts), and with `revalidate = 86400` those empty versions
// would be served for a day after each deploy: no products in the HTML, empty
// product sitemaps, an empty Merchant feed.
//
// So once the server is listening, it calls its own revalidation endpoint
// (app/api/internal/revalidate-build) — revalidatePath only works inside a
// request — and then requests the main pages so they regenerate from the
// database before crawlers or visitors get there. The endpoint is guarded by
// a token generated here per process, so nothing outside can trigger it.

// ISR route handlers that read the database. revalidatePath("/", "layout")
// covers the pages, but route handlers sit outside the layout tree and need
// to be named.
import { cacheTag } from "@/lib/cache-tag";

export const DATA_ROUTE_HANDLERS = [
  "/sitemap.xml",
  "/sitemap-pages.xml",
  "/sitemap-products.xml",
  "/sitemap-categories.xml",
  "/sitemap-blogs.xml",
  "/sitemap-images.xml",
  "/sitemap-videos.xml",
  "/google-feed",
  "/facebook-feed",
];

// Every tag the storefront's unstable_cache reads use.
export const DATA_CACHE_TAGS = (["settings", "categories", "products", "blog", "testimonials"] as const).map(
  (root) => cacheTag(root),
);

const WARM_PATHS = [
  "/",
  "/shop",
  "/blog",
  "/videos",
  "/bestsellers",
  "/new-arrivals",
  "/testimonials",
  ...DATA_ROUTE_HANDLERS,
];

export const STARTUP_TOKEN_HEADER = "x-startup-revalidate-token";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(origin: string, token: string): Promise<void> {
  // register() must finish before the server starts listening, so poll until
  // the endpoint answers (up to ~2 minutes).
  let revalidated = false;
  for (let attempt = 0; attempt < 60 && !revalidated; attempt++) {
    await sleep(2000);
    try {
      const res = await fetch(`${origin}/api/internal/revalidate-build`, {
        method: "POST",
        headers: { [STARTUP_TOKEN_HEADER]: token },
      });
      revalidated = res.ok;
    } catch {
      // Not listening yet.
    }
  }
  if (!revalidated) {
    console.error("[startup-revalidate] server never answered; build-time pages stay until their timer");
    return;
  }

  // One at a time: the VPS has little headroom and each render hits Postgres.
  for (const path of WARM_PATHS) {
    try {
      await fetch(`${origin}${path}`, { headers: { "user-agent": "startup-revalidate" } });
    } catch (err) {
      console.warn(`[startup-revalidate] warming ${path} failed:`, err);
    }
  }
  // The edge still holds the previous deploy's pages; drop them now that the
  // origin has fresh renders to refill from.
  const { purgeCdnNow } = await import("@/lib/cdn-purge");
  await purgeCdnNow();
  console.log(`[startup-revalidate] revalidated build-time cache, warmed ${WARM_PATHS.length} paths, purged CDN`);
}

export function scheduleStartupRevalidation(): void {
  const token = crypto.randomUUID();
  process.env.STARTUP_REVALIDATE_TOKEN = token;
  const origin = `http://127.0.0.1:${process.env.PORT || 3000}`;
  void run(origin, token);
}
