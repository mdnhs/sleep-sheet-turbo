import type { Metadata } from "next";
import { seoStore } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import { getVideoItems, VideosContent, videosMetadata } from "./videos-content";

// Cached with ISR for 24 hours at Vercel Edge CDN.
// The "products" cache tag invalidates when videos or products are updated.
//
// That only holds while nothing here reads searchParams: generateMetadata used
// to await them (to preview a shared ?v=<slug> link as that one video), which
// made the whole route render per request — the slowest TTFB on the site.
// Shared links are now served from /videos/share/[slug] via a rewrite in
// next.config.ts, so this page stays static.
export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return videosMetadata(await getVideoItems(), await seoStore());
}

export default async function VideosPage() {
  return <VideosContent items={await getVideoItems()} storeName={(await getStoreProfile()).name} />;
}
