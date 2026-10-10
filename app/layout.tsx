import type { Metadata } from "next";
import { Geist_Mono, Figtree, Hind_Siliguri, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import QueryProvider from "@/provider/query-provider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TrackingIdentity } from "@/provider/tracking-identity";
import { seoConfig, websiteSchema, organizationSchema, sameAsFromSettings, structuredDataScript } from "@/lib/seo";
import { getPublicSettings } from "@/lib/prefetch-home";
import GoogleAnalytics from "@/components/google-analytics";
import ConsentDefaultScript from "@/components/consent-default-script";
import SeoVerification from "@/components/seo-verification";
import VercelAnalytics from "@/components/vercel-analytics";
import PreconnectLinks from "@/components/preconnect";

// Only two fonts are on the storefront critical path: Figtree (body) and
// Space Grotesk (headings). Both preload. Geist Sans was previously loaded but
// its CSS variable is never referenced anywhere — removed entirely. Geist Mono
// is used only on dashboard/checkout screens (the `font-mono` class), so it is
// kept available but NOT preloaded, freeing bandwidth for the LCP image.
const spaceGroteskHeading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Bengali glyphs, for the dashboard screens written in Bengali (the
// `font-bengali` class). Same deal as Geist Mono: available but not
// preloaded, so the storefront's critical path is untouched — the browser
// only fetches it on a page that actually renders Bengali text.
const hindSiliguri = Hind_Siliguri({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(seoConfig.siteUrl),
  title: {
    default: seoConfig.defaultTitle,
    template: `%s | ${seoConfig.siteName}`,
  },
  description: seoConfig.defaultDescription,
  keywords: [
    "কম্ফোর্টার সেট প্রাইজ ইন বাংলাদেশ",
    "বিছানার চাদর অনলাইন শপ",
    "কিং সাইজ বেডশিট দাম",
    "ওয়াটারপ্রুফ স্লিপ শিট",
    "কটন বেডশীট কালেকশন",
    "টুইল কটন বিছানার চাদর",
    "শীতের কম্ফোর্টার দাম",
    "বেবি স্লিপ শিট",
    "ম্যাট্রেস প্রোটেক্টর বাংলাদেশ",
    "হোটেল কোয়ালিটি বেডশীট",
    "বালিশের কভার ও কোলবালিশ কভার",
    "হোম ডেলিভারি ক্যাশ অন ডেলিভারি",
    "স্লিপ শিট বাংলাদেশ",
    "comforter price in Bangladesh",
    "bed sheet price in Bangladesh",
    "comforter set price in Bangladesh",
    "king size bed sheet price in Bangladesh",
    "waterproof sleep sheet Bangladesh",
    "bed sheet online shop Bangladesh",
    "twill cotton comforter 5 pcs set",
    "mattress protector price in Bangladesh",
    "pillow cover",
    "cash on delivery bedding",
    "online shopping Bangladesh",
    "bedding",
    "sleep accessories",
  ],
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
    locale: seoConfig.defaultLocale,
    url: seoConfig.siteUrl,
    siteName: seoConfig.siteName,
    title: seoConfig.defaultTitle,
    description: seoConfig.defaultDescription,
    images: [
      {
        url: seoConfig.defaultImage,
        width: 1200,
        height: 630,
        alt: seoConfig.siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seoConfig.defaultTitle,
    description: seoConfig.defaultDescription,
    images: [seoConfig.defaultImage],
  },
  alternates: {
    canonical: seoConfig.siteUrl,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: seoConfig.siteName,
  },
  applicationName: seoConfig.siteName,
  referrer: "origin-when-cross-origin",
  category: "ecommerce",
  other: {
    "msapplication-TileColor": seoConfig.themeColor,
    "msapplication-config": "/browserconfig.xml",
  },
};

export const viewport = {
  themeColor: seoConfig.themeColor,
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Only for the Organization schema's sameAs (the social profiles that
  // actually exist). Cached and tag-invalidated, so no per-request DB hit.
  const settings = await getPublicSettings().catch(() => null);

  return (
    <html
      lang="bn"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistMono.variable,
        "font-sans",
        figtree.variable,
        spaceGroteskHeading.variable,
        hindSiliguri.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <ConsentDefaultScript />
        <PreconnectLinks />
        {structuredDataScript("organization", organizationSchema(sameAsFromSettings(settings)))}
        {structuredDataScript("website", websiteSchema())}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {/* No app-wide TooltipProvider: importing it here put base-ui's
              tooltip stack in every page's JS. The dashboard layout provides
              one for its sidebar; the storefront's desktop-only navbar
              tooltips load theirs on demand (components/lazy-tooltip.tsx). */}
          <Toaster />
          <QueryProvider>
            <SeoVerification />
            <GoogleAnalytics />
            <TrackingIdentity />
            <NuqsAdapter>
              {children}
            </NuqsAdapter>
          </QueryProvider>
        </ThemeProvider>
        <VercelAnalytics />
      </body>
    </html>
  );
}
