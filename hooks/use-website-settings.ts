"use client";

import { useSettings } from "@/features/settings/api/use-settings";
import { SHIPPING_ZONES } from "@/features/checkout/schema";

export function useWebsiteSettings() {
  const { data: settings, ...rest } = useSettings();

  return {
    ...rest,
    settings,
    siteName: settings?.site_name || "LUXSTORE",
    logoUrl: settings?.logo_url || "/logo.webp",
    heroTitle: settings?.hero_title || "Premium Comfort",
    heroSubtitle: settings?.hero_subtitle || "Luxury Comforters",
    heroCtaText: settings?.hero_cta_text || "Order Now",
    heroCtaLink: settings?.hero_cta_link || "/shop",
    heroBgImage: settings?.hero_bg_image || "",
    heroSlides: (() => {
      if (settings?.hero_slides) {
        try {
          return JSON.parse(settings.hero_slides) as Array<{
            id: string;
            image: string;
            title: string;
            heading: string;
            link: string;
          }>;
        } catch (e) {
          console.error("Failed to parse hero_slides", e);
        }
      }
      return null;
    })(),
    promoBanners: (() => {
      if (settings?.promo_banners) {
        try {
          return JSON.parse(settings.promo_banners) as Array<{
            id: string;
            image: string;
            subtitle: string;
            title: string;
            linkText: string;
            link: string;
          }>;
        } catch (e) {
          console.error("Failed to parse promo_banners", e);
        }
      }
      return null;
    })(),
    features: [
      {
        title: settings?.feature_1_title || "Payment only online",
        description: settings?.feature_1_desc || "Secure & simple checkout",
      },
      {
        title: settings?.feature_2_title || "New stocks and sales",
        description: settings?.feature_2_desc || "Daily updates & offers",
      },
      {
        title: settings?.feature_3_title || "Quality assurance",
        description: settings?.feature_3_desc || "100% genuine products",
      },
      {
        title: settings?.feature_4_title || "Delivery from 1 hour",
        description: settings?.feature_4_desc || "Fast & reliable shipping",
      },
    ],
    newsletterTitle: settings?.newsletter_title || "Join the inner circle",
    newsletterSubtitle:
      settings?.newsletter_subtitle ||
      "Subscribe for early access to new collections, exclusive styling tips, and members-only offers.",
    footerBrandDesc:
      settings?.footer_brand_desc ||
      "Elevating your rest with premium, ethically crafted bedding for the modern sanctuary.",
    footerEmail: settings?.footer_email || "support@sleepsheet.com",
    footerPhone: settings?.footer_phone || "+8801570241052",
    footerAddress: settings?.footer_address || "",
    footerAddressLink: settings?.footer_address_link || "",
    // What checkout actually bills (same settings and fallbacks as
    // getShippingCost in features/checkout/server/route.ts) — policy pages
    // read these instead of hardcoding amounts that drift from the DB.
    shippingInsideDhaka: Number(settings?.shipping_inside_dhaka ?? SHIPPING_ZONES.inside_dhaka.cost),
    shippingOutsideDhaka: Number(settings?.shipping_outside_dhaka ?? SHIPPING_ZONES.outside_dhaka.cost),
    socialFacebook: settings?.social_facebook || "",
    socialInstagram: settings?.social_instagram || "",
    socialTwitter: settings?.social_twitter || "",
    socialYoutube: settings?.social_youtube || "",
    socialTiktok: settings?.social_tiktok || "",
    footerCopyright:
      settings?.footer_copyright ||
      `© ${new Date().getFullYear()} SLEEP SHEET. All rights reserved.`,
  };
}
