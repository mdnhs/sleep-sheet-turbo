/**
 * Store values used when a setting has never been saved.
 *
 * This is the only app module allowed to name the store (brief §4, SP-1
 * acceptance: `grep -rn "Sleep Sheet"` matches only this file and tests).
 * Everything else reads the settings registry (lib/settings/registry.ts) or
 * the store profile (lib/settings/store-profile.ts), which fall back to these.
 * Kept free of zod and of server imports: client bundles read it.
 */

// Must be the host the site is actually served from (apex, not www), or
// every canonical, sitemap URL and og:url points at a redirect.
export const DEFAULT_SITE_URL = "https://sleepsheetbd.com";

export const STORE_DEFAULTS = {
  name: "Sleep Sheet",
  nameBn: "স্লিপ শীট",
  legalName: "Sleep Sheet",
  logoUrl: "/logo.webp",
  phone: "+8801570241052",
  email: "sleepsheet2025@gmail.com",
  address: "Hope Market, Mirpur 10",
  addressLink: "",
  city: "Dhaka",
  postalCode: "1216",
  dbid: "",
  tradeLicence: "",
  bin: "",
  locale: "bn_BD",
  timezone: "Asia/Dhaka",
  description: "Premium bedding and comforter sets in Bangladesh, with cash on delivery nationwide.",
  foundingYear: "2024",
  social: {
    facebook: "https://www.facebook.com/sleepsheet2025",
    instagram: "https://www.instagram.com/sleepsheet2025",
    twitter: "",
    youtube: "",
    tiktok: "",
  },
} as const;

export const SEO_DEFAULTS = {
  // Brand + shop intent only; the "… Price in Bangladesh" phrases belong to
  // the category pages, or our own pages compete for the same query.
  title: "Sleep Sheet — Comforter & Bed Sheet Online Shop in Bangladesh",
  description:
    "১০০% টুইল কটন কম্ফোর্টার সেট ও কিং সাইজ বেডশিট অনলাইনে কিনুন। ক্যাশ অন ডেলিভারি, সারা বাংলাদেশে হোম ডেলিভারি আর ৭ দিনের রিপ্লেসমেন্ট গ্যারান্টি।",
  // 1200×630 share card rendered by app/og-image.png/route.tsx.
  image: "/og-image.png",
  themeColor: "#0f172a",
  keywords: [
    "কম্ফোর্টার সেট প্রাইজ ইন বাংলাদেশ",
    "বিছানার চাদর অনলাইন শপ",
    "কিং সাইজ বেডশিট দাম",
    "ওয়াটারপ্রুফ স্লিপ শিট",
    "কটন বেডশীট কালেকশন",
    "টুইল কটন বিছানার চাদর",
    "শীতের কম্ফোর্টার দাম",
    "বেবি স্লিপ শিট",
    "ম্যাট্রেস প্রোটেক্টর বাংলাদেশ",
    "হোটেল কোয়ালিটি বেডশীট",
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
} as const;

export const BUSINESS_DEFAULTS = {
  orderNumberPrefix: "ORD",
  posOrderNumberPrefix: "POS",
  lowStockThreshold: 10,
  invoiceLanguage: "bn",
  // The dashboard product list opened on this category before it was a setting.
  defaultProductCategory: "Comforters",
} as const;
