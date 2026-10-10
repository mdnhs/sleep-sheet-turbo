import type { Metadata } from "next";
import { SEO_DEFAULTS, SEO_KEYWORDS } from "@/lib/settings/defaults";
import type { SiteSeo, StoreProfile } from "@/lib/settings/store-profile";

/**
 * The root layout's metadata, from the store profile and the SEO settings.
 *
 * Only `title` gets a template. og:title and twitter:title stay plain
 * strings: child pages set their own (lib/seo/metadata.ts already appends
 * the store name), and a template there would make them "X | Store | Store".
 */
export function buildRootMetadata(
  store: StoreProfile,
  seo: SiteSeo,
  baseUrl: string,
  env: { googleVerification?: string; bingVerification?: string } = {},
): Metadata {
  const google = seo.googleVerification || env.googleVerification || "";
  const bing = seo.bingVerification || env.bingVerification || "";
  const isDefaultImage = seo.image === SEO_DEFAULTS.image;

  return {
    metadataBase: new URL(baseUrl),
    title: { default: seo.title, template: `%s | ${store.name}` },
    description: seo.description,
    keywords: [...SEO_KEYWORDS],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: store.locale,
      url: baseUrl,
      siteName: store.name,
      title: seo.title,
      description: seo.description,
      images: [
        isDefaultImage
          ? { url: seo.image, width: 1200, height: 630, alt: store.name }
          : { url: seo.image, alt: store.name },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [seo.image],
      ...(seo.twitterHandle ? { site: seo.twitterHandle } : {}),
    },
    alternates: { canonical: baseUrl },
    icons: { icon: "/favicon.ico", shortcut: "/favicon.ico", apple: "/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: store.name },
    applicationName: store.name,
    referrer: "origin-when-cross-origin",
    category: "ecommerce",
    ...(google || bing
      ? { verification: { ...(google ? { google } : {}), ...(bing ? { other: { "msvalidate.01": bing } } : {}) } }
      : {}),
    other: {
      "msapplication-TileColor": SEO_DEFAULTS.themeColor,
      "msapplication-config": "/browserconfig.xml",
    },
  };
}
