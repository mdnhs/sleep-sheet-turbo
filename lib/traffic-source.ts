// Where an order's visitor actually came from — a Facebook ad, a YouTube
// ad, a Google ad, or someone who just typed the URL in — captured at
// landing (client-side, this file) and turned into one label (pure
// `deriveLandingSource`, called server-side in checkout so both the
// logged-in and guest order paths agree).
//
// Deliberately a companion to lib/meta-fbc.ts rather than a merge into it:
// that file owns `_fbc` specifically (Meta's own cookie name and format,
// read by the Pixel too), while this owns everything Meta doesn't —
// `gclid` and the UTM parameters an advertiser tags a campaign's URL with.

export type LandingSource =
  | "facebook_ad"
  | "youtube_ad"
  | "google_ad"
  | "other_ad"
  | "facebook_organic"
  | "youtube_organic"
  | "organic_search"
  | "direct"
  | "referral";

/** What the dashboard prints for each bucket. */
export const LANDING_SOURCE_LABELS: Record<LandingSource, string> = {
  facebook_ad: "Facebook Ad",
  youtube_ad: "YouTube Ad",
  google_ad: "Google Ad",
  other_ad: "Other Ad",
  facebook_organic: "Facebook (Organic)",
  youtube_organic: "YouTube (Organic)",
  organic_search: "Organic Search",
  direct: "Direct / Normal Visitor",
  referral: "Referral",
};

export interface LandingSignals {
  gclid?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  /** Meta's own click id — read separately via lib/meta-fbc.ts, passed in
   * here only so this function has the full picture. */
  fbc?: string | null;
  /** document.referrer captured at landing, or null for direct traffic
   * (typed URL, bookmark, or an app — WhatsApp, Messenger, most Android
   * browsers opened from an ad — that strips it before handing off). */
  referrer?: string | null;
}

const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paid_social", "paidsocial", "ad", "ads"]);
const SEARCH_ENGINE_HOSTS = ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex."];

function hostOf(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isFacebookHost(host: string): boolean {
  return host === "facebook.com" || host.endsWith(".facebook.com") ||
    host === "instagram.com" || host.endsWith(".instagram.com") ||
    host === "fb.com" || host.endsWith(".fb.com");
}

function isYoutubeHost(host: string): boolean {
  return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be";
}

/**
 * One label for where an order's visitor came from.
 *
 * UTM tagging, when present, is the advertiser's own word for the source and
 * wins over anything inferred — but only when it actually names a known
 * platform; an unrecognised `utm_source` falls through to the click-id/
 * referrer checks below rather than being trusted blindly. `other_ad` exists
 * so a paid medium that isn't Facebook/YouTube/Google (TikTok, Pinterest, a
 * paid newsletter) is not mislabelled "Direct" just because in-app browsers
 * commonly strip the referrer.
 *
 * Without useful UTM tagging, the fallback is what the browser actually saw:
 * a click id (`gclid` from Google Ads — the same id Google Ads issues whether
 * the click was Search, Display, Shopping, or a YouTube ad) and, failing
 * that, the referrer's host.
 *
 * `fbc` never proves an ad on its own: Facebook appends `fbclid` to every
 * outbound link (organic posts, page bio, Messenger), and the `_fbc` cookie
 * outlives that click by 90 days. A Facebook ad is only counted when the
 * campaign URL is tagged with a paid `utm_medium`.
 *
 * `gclid` alone cannot tell a YouTube ad apart from a Search or Display ad —
 * Google Ads does not encode the network in the click id — so that split
 * only happens when the referrer confirms it (a web click-through) or the
 * advertiser tagged the campaign with `utm_source=youtube`. Video ads opened
 * inside the YouTube app do not carry a referrer at all and land in the
 * plain "Google Ad" bucket; there is no signal available here to recover
 * that split without the advertiser's own UTM tag.
 */
export function deriveLandingSource(input: LandingSignals): LandingSource {
  const utmSource = input.utmSource?.trim().toLowerCase() || "";
  const utmMedium = input.utmMedium?.trim().toLowerCase() || "";
  const isPaidMedium = PAID_MEDIUMS.has(utmMedium);
  const host = hostOf(input.referrer);

  if (utmSource) {
    const isFacebookSource = utmSource.includes("facebook") || utmSource.includes("instagram") || utmSource === "fb" || utmSource === "ig";
    const isYoutubeSource = utmSource.includes("youtube") || utmSource === "yt";
    const isGoogleSource = utmSource.includes("google");

    if (isFacebookSource) return isPaidMedium ? "facebook_ad" : "facebook_organic";
    if (isYoutubeSource) return isPaidMedium || input.gclid ? "youtube_ad" : "youtube_organic";
    if (isGoogleSource && (isPaidMedium || input.gclid)) return "google_ad";
    if (isPaidMedium) return "other_ad";
  }

  if (input.gclid) return isYoutubeHost(host) ? "youtube_ad" : "google_ad";
  if (input.fbc || isFacebookHost(host)) return "facebook_organic";
  if (isYoutubeHost(host)) return "youtube_organic";
  if (SEARCH_ENGINE_HOSTS.some((engine) => host.includes(engine))) return "organic_search";
  if (!host) return "direct";
  return "referral";
}

// ---------------------------------------------------------------------------
// Browser-side capture. Mirrors captureFbclid in lib/meta-fbc.ts: persisted
// to a cookie (90 days — long enough to cover a slow-considering buyer) plus
// a localStorage fallback for a browser that won't keep the cookie, and only
// overwritten when a NEW ad click_id shows up. Revisiting the same ad's
// landing page, or browsing in from an internal link, leaves the original
// capture — and its referrer, which is what actually happened at that first
// landing — untouched.

const STORAGE_KEY = "_landing_source_captured";
const COOKIE_NAME = "_landing_source";
const COOKIE_DAYS = 90;

interface StoredSignals {
  gclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
}

function setCookie(value: string, days: number): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function readStored(): StoredSignals | undefined {
  try {
    const raw = getCookie(COOKIE_NAME) || (typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null);
    return raw ? (JSON.parse(raw) as StoredSignals) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads `gclid`/`utm_*` off the current URL and `document.referrer`, and
 * persists them — but only on true first landing, or when a NEW `gclid`
 * shows up (a fresh ad click). Call once per page load, client-side.
 */
export function captureLandingSource(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const gclid = params.get("gclid");
    const existing = readStored();

    if (existing && (!gclid || existing.gclid === gclid)) return;

    const bundle: StoredSignals = {
      gclid: gclid || undefined,
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
      referrer: document.referrer || undefined,
    };
    const serialized = JSON.stringify(bundle);
    setCookie(serialized, COOKIE_DAYS);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    /* best-effort only — never block the page on this */
  }
}

/** The captured signals to submit with an order, or undefined if this
 * visitor's landing was never captured (e.g. captureLandingSource() has not
 * run yet, or every storage write failed). */
export function getCapturedLandingSignals(): StoredSignals | undefined {
  return readStored();
}
