// Product videos are uploaded from the admin form straight to Cloudinary (a
// video doesn't fit through a serverless function's request body) and only
// the resulting URL is stored on the product. This module is the pure,
// client-safe half: what a valid stored URL looks like, and the delivery /
// poster URLs derived from it. The signing and deleting half is in
// lib/cloudinary.ts.

export const PRODUCT_VIDEO_FOLDER = "products-video";
export const PRODUCT_VIDEO_FORMATS = ["mp4", "mov", "webm"] as const;
export const PRODUCT_VIDEO_MAX_BYTES = 60 * 1024 * 1024; // 60MB

// Applied at upload time (eager, asynchronous) so the delivered rendition
// already exists on first view, and again in the delivery URL — the two
// strings must match exactly or Cloudinary transcodes on the first request
// instead. 960px wide is plenty for a product page, and q_auto keeps the file
// small for mobile data.
export const PRODUCT_VIDEO_TRANSFORM = "c_limit,w_960,q_auto,f_mp4";
const posterTransform = (width: number) => `so_0,c_limit,w_${width},q_auto,f_auto`;

const MARKER = "/video/upload/";

/**
 * True for a plain Cloudinary video URL. When `cloudName` is given the URL
 * must belong to that account — the stored value comes from a form field, so
 * it is never trusted to be "some video URL" without checking whose it is.
 */
export function isCloudinaryVideoUrl(value: string, cloudName?: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return false;
  if (url.search || url.hash) return false;
  if (cloudName && !url.pathname.startsWith(`/${cloudName}${MARKER}`)) return false;
  return url.pathname.includes(MARKER);
}

function withTransform(url: string, transform: string, ext: string): string {
  const i = url.indexOf(MARKER);
  if (i === -1) return url;
  const head = url.slice(0, i + MARKER.length);
  const rest = url.slice(i + MARKER.length).replace(/\.[a-z0-9]+$/i, "");
  return `${head}${transform}/${rest}.${ext}`;
}

/** The compressed, 960px MP4 rendition shown on the product page. */
export function productVideoUrl(url: string): string {
  return withTransform(url, PRODUCT_VIDEO_TRANSFORM, "mp4");
}

/** The shareable address of one video: the /videos page opened on it. */
export function videoShareUrl(origin: string, slug: string): string {
  return `${origin}/videos?v=${encodeURIComponent(slug)}`;
}

/** A still frame from the start of the video, used as its poster/thumbnail. */
export function productVideoPoster(url: string, width = 960): string {
  return withTransform(url, posterTransform(width), "jpg");
}

/** A 1200x630 still of the video, cropped to fill — for og:image / Twitter cards. */
export function productVideoOgImage(url: string): string {
  return withTransform(url, "so_0,c_fill,w_1200,h_630,q_auto,f_jpg", "jpg");
}

/** The Cloudinary public id (folder/name, no version or extension) — what deleting needs. */
export function productVideoPublicId(url: string): string | null {
  const i = url.indexOf(MARKER);
  if (i === -1) return null;
  const segments = url
    .slice(i + MARKER.length)
    .split("/")
    // Drop the version (v123…) and any transformation segments (they contain
    // `_` or `,`); a folder name here never does.
    .filter((s) => !/^v\d+$/.test(s) && !/[_,]/.test(s) || s.includes("."));
  const path = segments.join("/").replace(/\.[a-z0-9]+$/i, "");
  return path || null;
}

// Autoplaying several videos is the heaviest thing on the landing page, so
// only do it when the visitor hasn't asked for less: reduced motion, or
// "data saver" on a phone, both fall back to a poster that plays on tap.
export function autoplayAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !connection?.saveData;
}

/** True when the visitor has asked to save data (Android "Data saver"). */
export function saveDataEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
}
