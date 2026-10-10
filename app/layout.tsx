import type { Metadata } from "next";
import { Geist_Mono, Figtree, Hind_Siliguri, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import QueryProvider from "@/provider/query-provider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TrackingIdentity } from "@/provider/tracking-identity";
import { seoConfig, websiteSchema, organizationSchema, structuredDataScript } from "@/lib/seo";
import { buildRootMetadata } from "@/lib/seo/root-metadata";
import { getPublicSettings } from "@/lib/prefetch-home";
import { getSiteSeo, getStoreProfile } from "@/lib/settings/store";
import { siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";
import GoogleAnalytics from "@/components/google-analytics";
import ConsentDefaultScript from "@/components/consent-default-script";
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

// Store name, title, description, share image and verification come from
// settings. Same cached, "settings"-tagged read as the body below, so the
// root stays prerendered and a settings save refreshes it.
export async function generateMetadata(): Promise<Metadata> {
  const [store, seo] = await Promise.all([getStoreProfile(), getSiteSeo()]);
  return buildRootMetadata(store, seo, seoConfig.siteUrl, {
    googleVerification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
    bingVerification: process.env.NEXT_PUBLIC_BING_VERIFICATION,
  });
}

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
  // Cached and tag-invalidated, so no per-request DB hit.
  const settings = await getPublicSettings().catch(() => null);
  const store = storeProfileFromSettings(settings);
  const seo = siteSeoFromSettings(settings);

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
        {structuredDataScript("organization", organizationSchema(store))}
        {structuredDataScript("website", websiteSchema(store, seo))}
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
            <GoogleAnalytics />
            <TrackingIdentity />
            <NuqsAdapter>
              {children}
            </NuqsAdapter>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
