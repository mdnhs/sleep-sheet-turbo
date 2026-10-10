import type { Metadata } from "next";
import { Suspense } from "react";
import {
  breadcrumbSchema,
  generateMetadata as buildMetadata,
  jsonLd,
  seoConfig,
  structuredDataScript,
} from "@/lib/seo";
import { getAllPublicProductVideos } from "@/lib/prefetch-home";
import { productVideoOgImage, productVideoPoster, productVideoUrl, videoShareUrl } from "@/lib/product-video";
import VideosGrid from "./videos-grid";

function VideosGridFallback() {
  return (
    <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="h-4 w-32 bg-muted/60 animate-pulse rounded mb-4" />
        <div className="h-8 w-64 bg-muted/60 animate-pulse rounded mb-2" />
        <div className="h-4 w-96 max-w-full bg-muted/60 animate-pulse rounded mb-5" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[9/16] rounded-2xl bg-muted/60 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Cached with ISR for 24 hours at Vercel Edge CDN.
// The "products" cache tag invalidates when videos or products are updated.
export const revalidate = 86400;

const pageUrl = `${seoConfig.siteUrl}/videos`;

type Props = { searchParams: Promise<{ v?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { v } = await searchParams;
  const slug = Array.isArray(v) ? v[0] : v;
  const res = await getAllPublicProductVideos().catch(() => null);
  const items = res?.data ?? [];

  // A shared link (/videos?v=<slug>) previews as that one video — its name,
  // blurb and a frame as the image — while the canonical stays the main /videos
  // page, so the per-video URLs don't compete with it in search results.
  const current = slug ? items.find((item) => item.slug === slug) : undefined;
  if (current) {
    const meta = buildMetadata({
      title: `${current.name} – Product Video`,
      description: current.description || `Watch ${current.name} on ${seoConfig.siteName}.`,
      canonical: pageUrl,
      openGraph: { image: productVideoOgImage(current.video), imageAlt: `${current.name} – product video` },
    });
    return { ...meta, openGraph: { ...meta.openGraph, url: videoShareUrl(seoConfig.siteUrl, current.slug) } };
  }

  const description = items.length
    ? `Watch ${items.length} ${seoConfig.siteName} product videos — twill cotton comforters, bed sheets and pillow covers in action, with prices. Order online, cash on delivery all over Bangladesh.`
    : `Watch ${seoConfig.siteName} comforters, bed sheets and more in action — product videos you can order from.`;

  return buildMetadata({
    title: "Comforter & Bed Sheet Product Videos",
    description,
    canonical: pageUrl,
    // A video frame as the share image, so a link to this page previews well.
    openGraph: items[0]
      ? { image: productVideoOgImage(items[0].video), imageAlt: `${items[0].name} – product video` }
      : undefined,
    // Nothing to show yet: an empty page is a thin one, keep it out of the index.
    noIndex: items.length === 0,
  });
}

export default async function VideosPage() {
  const res = await getAllPublicProductVideos().catch(() => null);
  const items = res?.data ?? [];

  // CollectionPage -> ItemList -> VideoObject, one per video. Each points at the
  // product page that also shows the video (it is that page's first gallery slide).
  const collection = jsonLd({
    "@type": "CollectionPage",
    name: `Product Videos | ${seoConfig.siteName}`,
    url: pageUrl,
    description: `Product videos from ${seoConfig.siteName}.`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${seoConfig.siteUrl}/shop/${p.slug}`,
        item: {
          "@type": "VideoObject",
          name: `${p.name} – video`,
          description: p.description || p.name,
          thumbnailUrl: productVideoPoster(p.video),
          contentUrl: productVideoUrl(p.video),
          uploadDate: p.uploadDate ?? new Date().toISOString(),
          url: `${seoConfig.siteUrl}/shop/${p.slug}`,
          inLanguage: "bn",
        },
      })),
    },
  });

  return (
    <>
      {structuredDataScript("collection-page", collection)}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Product Videos", url: "/videos" },
        ]),
      )}
      <Suspense fallback={<VideosGridFallback />}>
        <VideosGrid items={items} />
      </Suspense>
    </>
  );
}
