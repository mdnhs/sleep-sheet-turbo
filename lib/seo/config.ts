// Must be the host the site is actually served from. Vercel serves the apex
// (sleepsheetbd.com) and redirects www → apex, so a www default made every
// canonical, sitemap URL, og:url and JSON-LD url point at a redirect — Google
// then has to guess which host is canonical.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sleepsheetbd.com";

export const seoConfig = {
  siteName: "Sleep Sheet",
  siteUrl,
  // Brand + shop intent only. The "… Price in Bangladesh" keywords belong to
  // the category pages (/categories/comforters, /categories/bedsheet); when the
  // homepage title targeted them too, three or four of our own pages competed
  // for the same query and none of them ranked.
  defaultTitle: "Sleep Sheet — Comforter & Bed Sheet Online Shop in Bangladesh",
  defaultDescription:
    "১০০% টুইল কটন কম্ফোর্টার সেট ও কিং সাইজ বেডশিট অনলাইনে কিনুন। ক্যাশ অন ডেলিভারি, সারা বাংলাদেশে হোম ডেলিভারি আর ৭ দিনের রিপ্লেসমেন্ট গ্যারান্টি।",
  // 1200×630 share card rendered by app/og-image.png/route.tsx.
  defaultImage: "/og-image.png",
  // Matches <html lang="bn"> and the Bangladesh audience — was en_US.
  defaultLocale: "bn_BD",
  themeColor: "#0f172a",
  organization: {
    name: "Sleep Sheet",
    url: siteUrl,
    // Absolute: Google's logo guidelines for Organization require a full URL.
    logo: `${siteUrl}/logo.webp`,
    description: "Premium bedding and comforter sets in Bangladesh, with cash on delivery nationwide.",
    foundingDate: "2024",
    founders: [],
    // Fallback only — the root layout builds sameAs from the social_* site
    // settings, which list the accounts that actually exist (no Twitter,
    // YouTube or Pinterest account today).
    sameAs: [
      "https://www.facebook.com/sleepsheet2025",
      "https://www.instagram.com/sleepsheet2025",
    ],
  },
  address: {
    streetAddress: "Hope Market, Mirpur 10",
    addressLocality: "Dhaka",
    addressRegion: "Dhaka",
    postalCode: "1216",
    addressCountry: "BD",
  },
  contact: {
    telephone: "+8801570241052",
    email: "sleepsheet2025@gmail.com",
    contactType: "customer service",
  },
  // Fallbacks for when site settings haven't loaded. Twitter, YouTube and
  // Pinterest were listed here but don't exist (social_twitter/_youtube are
  // empty in settings), so the footer and contact page linked to dead
  // profiles.
  socialLinks: {
    facebook: "https://www.facebook.com/sleepsheet2025",
    instagram: "https://www.instagram.com/sleepsheet2025",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || "",
    bing: process.env.NEXT_PUBLIC_BING_VERIFICATION || "",
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || "",
  },
};
