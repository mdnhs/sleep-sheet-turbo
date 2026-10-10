import type { Metadata } from "next";
import { seoStore } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import { getVideoItems, VideosContent, videosMetadata } from "../../videos-content";

// What a shared /videos?v=<slug> link is actually served from: a beforeFiles
// rewrite in next.config.ts maps that query onto this path, so the browser
// keeps the /videos?v=<slug> address (the grid reads ?v= to open the viewer)
// while the HTML carries that video's preview metadata. Being a path rather
// than a query, it caches per video like any ISR page — reading searchParams
// on /videos itself is what used to make that route render on every request.
export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

// Nothing prerendered at build: a video's share page renders the first time
// its link is opened (usually by a social network's link-preview crawler) and
// is cached from then on, until the "products" tag or the timer drops it.
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // An unknown slug (e.g. a deleted video) falls back to the plain /videos
  // preview, as the old ?v= handling did.
  return videosMetadata(await getVideoItems(), await seoStore(), slug);
}

export default async function VideoSharePage() {
  return <VideosContent items={await getVideoItems()} storeName={(await getStoreProfile()).name} />;
}
