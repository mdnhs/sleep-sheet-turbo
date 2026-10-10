// Cloudflare sits in front of sleepsheetbd.com and edge-caches every page the
// origin marks cacheable (ISR pages send s-maxage=86400). revalidateTag()
// only refreshes the origin's copy, so without a purge the Dhaka edge would
// keep serving the old price, stock or post for up to a day.
//
// Every invalidation helper (lib/content-cache.ts, lib/meta-catalog/cache.ts,
// the settings PATCH) and the post-deploy warm-up (lib/startup-revalidate.ts)
// calls purgeCdn(). Purges are coalesced: a burst of writes — an import, a
// few orders landing together — becomes one purge a few seconds after the
// last one, by which time the origin has the fresh render ready.
//
// Everything is purged rather than individual URLs: one product shows up on
// the home page, its category, shop, bestsellers, sitemaps and both feeds,
// and the site is small enough that refilling the edge costs little.
//
// No-op unless CLOUDFLARE_ZONE_ID and CLOUDFLARE_PURGE_TOKEN are set (local
// dev, or before the zone is active).

const PURGE_DELAY_MS = 5_000;

let timer: ReturnType<typeof setTimeout> | null = null;

export async function purgeCdnNow(): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_PURGE_TOKEN;
  if (!zoneId || !token) return;

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ purge_everything: true }),
    });
    if (!res.ok) {
      console.error(`[cdn-purge] Cloudflare purge failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[cdn-purge] Cloudflare purge failed:", err);
  }
}

export function purgeCdn(): void {
  if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_PURGE_TOKEN) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void purgeCdnNow();
  }, PURGE_DELAY_MS);
}
