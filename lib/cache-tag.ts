/**
 * The one place a Next.js cache tag is spelled (brief §3, SaaS-ready rule 4).
 * When several stores share one database, the store prefix goes in here and
 * every unstable_cache read and revalidateTag call picks it up.
 */
export type CacheTagRoot = "settings" | "products" | "categories" | "blog" | "testimonials" | "promotions";

export function cacheTag(root: CacheTagRoot, ...scope: string[]): string {
  return [root, ...scope].join(":");
}
