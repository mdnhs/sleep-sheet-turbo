import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { cfImageUrl, unwrapCfImageUrl } from "./media-url"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Floors to the nearest 50 — used for the storefront's struck-through
 * "original price" so reversing the discount math (e.g. ৳1,533) reads as a
 * clean ৳1,500 instead of an odd exact figure. Display-only: never applied
 * to the actual discounted price or anything sent to Meta's catalog feed.
 */
export function floorToNearest50(amount: number): number {
  return Math.floor(amount / 50) * 50;
}

const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** 100 → "১০০" — for numbers dropped into Bengali copy. */
export function toBengaliDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => BENGALI_DIGITS[Number(d)]);
}

export function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractTags(title: string, content?: string, brandTag?: string): string[] {
  const genericTags = [
    "Best Comforters in Bangladesh",
    "Best Price Comforters in BD",
    ...(brandTag ? [brandTag] : []),
    "Premium Bedding Set BD",
    "Home Textile Bangladesh",
  ];

  if (!title) return genericTags;

  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "for", "nor", "on", "at", "to", "from",
    "by", "with", "in", "out", "over", "under", "this", "that", "these", "those",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do",
    "does", "did", "how", "what", "why", "where", "when", "who", "which", "tips",
    "guide", "best", "top", "এই", "এবং", "জন্য", "করা", "হলে", "কি", "না", "সেরা",
    "সম্পূর্ণ", "গাইড", "কেনার", "উপভোগ", "করুন", "আরামদায়ক", "কথা", "সম্পর্কে",
  ]);

  const words = title
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));

  const uniqueTitleTags = Array.from(new Set(words))
    .slice(0, 4)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));

  return Array.from(new Set([...uniqueTitleTags, ...genericTags]));
}

export const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

export type SortOptionValue = typeof sortOptions[number]['value'];

export  const categories = [
  { value: "electronics", label: "Electronics" },
  { value: "clothing", label: "Clothing" },
  { value: "home-appliances", label: "Home Appliances" },
  { value: "books", label: "Books" },
  { value: "footwear", label: "Footwear" },
];

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);

  return date.toLocaleString("en-US", {
    // Pinned so the server (UTC) and the browser (Dhaka) print the same day:
    // otherwise anything dated 18:00–24:00 UTC renders one date in the cached
    // HTML and another in the browser, a hydration mismatch.
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "long",
    day: "numeric",
    // hour: "2-digit",
    // minute: "2-digit",
    // second: "2-digit",
    // hour12: true, 
  });
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};



// Date range helpers re-exported from ./date-utils so client components
// importing cn() don't bundle date-fns.
export {
  getDateRange,
  getPreviousRange,
  getPreviousDateRange,
  resolveDateRange,
  getTrendBucketUnit,
  getStartDate,
} from "./date-utils";

export function getOptimizedImageUrl(url: string | null | undefined, width?: number): string {
  if (!url) return "";
  const targetWidth = width || 1000;
  if (url.startsWith("https://res.cloudinary.com/")) {
    const uploadIndex = url.indexOf("/image/upload/");
    if (uploadIndex !== -1) {
      const start = url.slice(0, uploadIndex + 14);
      let rest = url.slice(uploadIndex + 14);

      // Strip any old existing Cloudinary transformation segments before re-applying optimized params
      if (/^(?:[a-z]_[^/]+,)*[a-z]_[^/]+\//.test(rest)) {
        rest = rest.replace(/^(?:[a-z]_[^/]+,)*[a-z]_[^/]+\//, "");
      }

      const transform = `f_auto,q_auto:good,c_limit,w_${targetWidth}/`;
      return `${start}${transform}${rest}`;
    }
    return url;
  }
  if (url.startsWith("https://") && !url.includes("images.unsplash.com")) {
    return cfImageUrl(url, `width=${targetWidth},quality=85,format=auto,fit=scale-down`);
  }
  return url;
}

/**
 * The stable identity of a stored image for duplicate detection: the
 * Cloudinary public id, or the path of an R2 object. Null for anything else.
 */
export function getImageIdentity(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("https://res.cloudinary.com/")) return getCloudinaryPublicId(url);
  const source = unwrapCfImageUrl(url);
  if (!source.startsWith("https://")) return null;
  try {
    return new URL(source).pathname.replace(/^\/+/, "").replace(/\.[a-zA-Z0-9]+$/, "") || null;
  } catch {
    return null;
  }
}

/**
 * The stable identity of a Cloudinary image, independent of whatever
 * transformation/version prefix happens to be baked into a given URL —
 * used to detect the same upload reused across multiple products (see
 * the "Duplicates" product view). Returns null for anything that isn't
 * a Cloudinary upload URL.
 */
export function getCloudinaryPublicId(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("https://res.cloudinary.com/")) return null;
  const uploadIndex = url.indexOf("/image/upload/");
  if (uploadIndex === -1) return null;

  let rest = url.slice(uploadIndex + 14);
  // Same transformation-segment pattern getOptimizedImageUrl strips.
  rest = rest.replace(/^(?:[a-z]_[^/]+,)*[a-z]_[^/]+\//, "");
  rest = rest.replace(/^v\d+\//, "");
  return rest.replace(/\.[a-zA-Z0-9]+$/, "");
}

export function calculateItemUnitPrice(
  color: string | null | undefined,
  basePrice: number,
  variants?: { name: string; price: number | null }[] | null,
  addOns?: { name: string; price: number }[] | null
): number {
  if (!color) return basePrice;

  let baseColorName = color;
  if (color.includes(" (+ ")) {
    baseColorName = color.split(" (+ ")[0];
  } else if (color.startsWith("Add-ons: ")) {
    baseColorName = "";
  }

  const variant = variants?.find((v) => v.name === baseColorName);
  let price =
    variant && variant.price !== null && variant.price !== undefined
      ? variant.price
      : basePrice;

  if (addOns && addOns.length > 0) {
    for (const addOn of addOns) {
      if (!addOn.name) continue;
      const escapedName = addOn.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`${escapedName}\\s+x(\\d+)`);
      const match = color.match(regex);
      if (match && match[1]) {
        const qty = parseInt(match[1], 10);
        if (!isNaN(qty) && qty > 0) {
          price += addOn.price * qty;
        }
      }
    }
  }

  return price;
}

// Bought-cost counterpart to calculateItemUnitPrice: parses the same
// "BaseVariant (+ AddOnName xN)" encoding out of the stored `color` string
// and sums each matched add-on's costPrice (not its selling price) so admins
// entering an order item's bought price have a number to check against —
// the order item's own costPrice is a single manually-entered field with no
// separate slot for "this also included N curtains," so that cost is easy
// to forget unless it's surfaced explicitly.
export function calculateItemAddOnCost(
  color: string | null | undefined,
  addOns?: { name: string; price: number; costPrice?: number }[] | null
): number {
  if (!color || !addOns || addOns.length === 0) return 0;

  let total = 0;
  for (const addOn of addOns) {
    if (!addOn.name || !addOn.costPrice) continue;
    const escapedName = addOn.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escapedName}\\s+x(\\d+)`);
    const match = color.match(regex);
    if (match && match[1]) {
      const qty = parseInt(match[1], 10);
      if (!isNaN(qty) && qty > 0) {
        total += addOn.costPrice * qty;
      }
    }
  }
  return total;
}

// Whether the stored `color` string encodes at least one add-on selection
// (e.g. "Red (+ Curtain x2)" or "Add-ons: Curtain x2"). Unlike
// calculateItemAddOnCost, this doesn't depend on the product's catalog
// add-ons being loaded or having a costPrice set — so admin cost-entry UIs
// can still offer an add-on bought-price input (defaulting to blank) even
// when there's nothing to suggest a number from.
export function colorHasAddOn(color: string | null | undefined): boolean {
  if (!color) return false;
  return color.includes(" (+ ") || color.trim().startsWith("Add-ons:");
}

export function enrichColorWithAddOnPrices(
  color: string | undefined | null,
  addOns?: { name: string; price: number }[] | null,
  formatAmount?: (price: number) => string
): string {
  if (!color) return "";
  if (!addOns || addOns.length === 0) return color;

  let result = color;
  for (const addOn of addOns) {
    if (!addOn.name) continue;
    const escapedName = addOn.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedName}\\s+x\\d+)(?!\\s*\\()`, "g");
    const formattedPrice = formatAmount ? formatAmount(addOn.price) : `${addOn.price} TK`;
    result = result.replace(regex, `$1 (${formattedPrice})`);
  }
  return result;
}

