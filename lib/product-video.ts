// Product videos are uploaded from the admin form straight to storage (a
// video doesn't fit through a serverless function's request body) and only
// the resulting URL is stored on the product. This module is the pure,
// client-safe half: what a valid stored URL looks like, and the delivery /
// poster URLs derived from it. The signing and deleting half is in
// lib/media.ts.
//
// A stored URL is either a Cloudinary one (transformed by Cloudinary) or an
// R2 one (transformed by Cloudflare Media Transformations, lib/media-url.ts).

import { cfMediaUrl, isCloudinaryUrl } from "@/lib/media-url";

export const PRODUCT_VIDEO_FOLDER = "products-video";
export const PRODUCT_VIDEO_FORMATS = ["mp4", "mov", "webm"] as const;
export const PRODUCT_VIDEO_MAX_BYTES = 60 * 1024 * 1024; // 60MB

// R2 uploads: Media Transformations is only documented for MP4 (H.264), so
// WebM is not offered there.
export const PRODUCT_VIDEO_R2_TYPES = { "video/mp4": "mp4", "video/quicktime": "mov" } as const;
export type ProductVideoR2Type = keyof typeof PRODUCT_VIDEO_R2_TYPES;

// Applied at upload time (eager, asynchronous) so the delivered rendition
// already exists on first view, and again in the delivery URL — the two
// strings must match exactly or Cloudinary transcodes on the first request
// instead. 960px wide is plenty for a product page, and q_auto keeps the file
// small for mobile data.
export const PRODUCT_VIDEO_TRANSFORM = "c_limit,w_960,q_auto,f_mp4";
const posterTransform = (width: number) => `so_0,c_limit,w_${width},q_auto,f_auto`;

// The Cloudflare equivalents for R2 videos.
const CF_VIDEO = "mode=video,width=960,fit=scale-down";
const cfPoster = (width: number) => `mode=frame,time=0s,width=${width},fit=scale-down,format=jpg`;
const CF_OG = "mode=frame,time=0s,width=1200,height=630,fit=cover,format=jpg";

// Without a transform origin (local dev) an R2 video has no generated still.
const NO_POSTER = "/placeholder.jpg";

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

/**
 * True for a product video in this store's R2 bucket: `publicUrl` (the
 * bucket's public base URL) + the video folder + one file name. Same reason
 * as above — the value comes from a form field.
 */
export function isR2VideoUrl(value: string, publicUrl: string): boolean {
  const base = publicUrl.replace(/\/+$/, "");
  if (!base.startsWith("https://")) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.search || url.hash) return false;
  const prefix = `${base}/${PRODUCT_VIDEO_FOLDER}/`;
  if (!url.href.startsWith(prefix)) return false;
  const name = url.href.slice(prefix.length);
  return /^[A-Za-z0-9_-]+\.(mp4|mov)$/.test(name);
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
  if (isCloudinaryUrl(url)) return withTransform(url, PRODUCT_VIDEO_TRANSFORM, "mp4");
  return cfMediaUrl(url, CF_VIDEO) ?? url;
}

/** The shareable address of one video: the /videos page opened on it. */
export function videoShareUrl(origin: string, slug: string): string {
  return `${origin}/videos?v=${encodeURIComponent(slug)}`;
}

/** A still frame from the start of the video, used as its poster/thumbnail. */
export function productVideoPoster(url: string, width = 960): string {
  if (isCloudinaryUrl(url)) return withTransform(url, posterTransform(width), "jpg");
  return cfMediaUrl(url, cfPoster(width)) ?? NO_POSTER;
}

/** A 1200x630 still of the video, cropped to fill — for og:image / Twitter cards. */
export function productVideoOgImage(url: string): string {
  if (isCloudinaryUrl(url)) return withTransform(url, "so_0,c_fill,w_1200,h_630,q_auto,f_jpg", "jpg");
  return cfMediaUrl(url, CF_OG) ?? NO_POSTER;
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
