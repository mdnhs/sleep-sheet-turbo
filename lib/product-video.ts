// Product videos are uploaded from the admin form straight to storage (a
// video doesn't fit through a serverless function's request body) and only
// the resulting URL is stored on the product. This module is the pure,
// client-safe half: what a valid stored URL looks like, and the delivery /
// poster URLs derived from it. The signing and deleting half is in
// lib/media.ts.
//
// A stored URL is either a Cloudinary one (transformed by Cloudinary) or an
// R2 one, delivered through files generated from it once (see
// VIDEO_DERIVATIVES below).

import { cfImageUrl, cfMediaUrl, isCloudinaryUrl } from "@/lib/media-url";

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

// R2 videos are not played through Cloudflare Media Transformations
// directly: /cdn-cgi/media never answers a Range request with 206, so Safari
// can't play it (iPhones fell back to the 4–6MB original), and its stills are
// JPEG-only and can't be fed to /cdn-cgi/image for AVIF. Instead these files
// are generated from it once, when the video is uploaded or saved
// (lib/video-derivatives.ts), and served from R2 like any other object —
// edge-cached, range-capable. `_derived/` is hidden from the media library;
// bump the version segment to regenerate with new settings.
export const VIDEO_DERIVATIVES = {
  poster: { file: "poster.jpg", type: "image/jpeg", transform: "mode=frame,time=0s,width=1080,fit=scale-down,format=jpg" },
  // The full player (product page, reels): the uploads are ~720px wide, so
  // this is their native size, re-encoded at about half the bytes.
  hd: { file: "720.mp4", type: "video/mp4", transform: "mode=video,width=720,fit=scale-down" },
  // Grid cards, a few hundred CSS pixels wide: half the bytes again.
  sd: { file: "480.mp4", type: "video/mp4", transform: "mode=video,width=480,fit=scale-down" },
} as const;
export type VideoDerivative = keyof typeof VIDEO_DERIVATIVES;
export const VIDEO_DERIVED_ROOT = "_derived/v1";

// Fallback when a derivative is missing (not generated yet): the live
// transform, which plays everywhere but Safari.
const CF_VIDEO = "mode=video,width=960,fit=scale-down";
const cfPoster = (width: number) => `mode=frame,time=0s,width=${width},fit=scale-down,format=jpg`;

// A video with no still to show (not an R2 or Cloudinary URL).
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
  if (!url.href.startsWith(`${base}/`)) return false;
  return isProductVideoKey(url.href.slice(base.length + 1));
}

/** An R2 object key that can be a product video: the video folder + one MP4/MOV file name. */
export function isProductVideoKey(key: string): boolean {
  const prefix = `${PRODUCT_VIDEO_FOLDER}/`;
  return key.startsWith(prefix) && /^[A-Za-z0-9_-]+\.(mp4|mov)$/.test(key.slice(prefix.length));
}

/** The R2 key of one derivative of a product video key, or null for anything else. */
export function videoDerivativeKey(videoKey: string, kind: VideoDerivative): string | null {
  if (!isProductVideoKey(videoKey)) return null;
  return `${VIDEO_DERIVED_ROOT}/${videoKey.replace(/\.[a-z0-9]+$/i, "")}/${VIDEO_DERIVATIVES[kind].file}`;
}

/** The public URL of one derivative of an R2 video URL (same bucket domain), or null. */
export function videoDerivativeUrl(url: string, kind: VideoDerivative): string | null {
  if (!url.startsWith("https://") || isCloudinaryUrl(url)) return null;
  const i = url.indexOf(`/${PRODUCT_VIDEO_FOLDER}/`);
  if (i === -1) return null;
  const key = videoDerivativeKey(url.slice(i + 1), kind);
  return key ? `${url.slice(0, i)}/${key}` : null;
}

function withTransform(url: string, transform: string, ext: string): string {
  const i = url.indexOf(MARKER);
  if (i === -1) return url;
  const head = url.slice(0, i + MARKER.length);
  const rest = url.slice(i + MARKER.length).replace(/\.[a-z0-9]+$/i, "");
  return `${head}${transform}/${rest}.${ext}`;
}

/** The compressed MP4 rendition: `hd` for the full player, `sd` for grid cards. */
export function productVideoUrl(url: string, size: "hd" | "sd" = "hd"): string {
  if (isCloudinaryUrl(url)) return withTransform(url, PRODUCT_VIDEO_TRANSFORM, "mp4");
  return videoDerivativeUrl(url, size) ?? url;
}

export type VideoSource = { src: string; type?: string };

/**
 * <source> list for a <video>, best first: the R2 rendition, then — should
 * it not have been generated — the live transform, then the original upload.
 * A browser only moves on when a source fails, so the later ones cost
 * nothing while the first plays.
 */
export function productVideoSources(url: string, size: "hd" | "sd" = "hd"): VideoSource[] {
  const sources: VideoSource[] = [{ src: productVideoUrl(url, size), type: "video/mp4" }];
  if (!isCloudinaryUrl(url)) {
    const live = cfMediaUrl(url, CF_VIDEO);
    if (live) sources.push({ src: live, type: "video/mp4" });
  }
  sources.push({ src: url });
  return sources.filter((s, i) => sources.findIndex((o) => o.src === s.src) === i);
}

/** The shareable address of one video: the /videos page opened on it. */
export function videoShareUrl(origin: string, slug: string): string {
  return `${origin}/videos?v=${encodeURIComponent(slug)}`;
}

/**
 * A still frame from the start of the video, used as its poster/thumbnail:
 * the stored still resized to `width` as AVIF/WebP (or the stored JPEG itself
 * where no transform origin is set, e.g. local dev). Quality 60: it is only
 * on screen until the video starts — 40KB at 540w against the 89KB JPEG
 * the live frame transform sent.
 */
export function productVideoPoster(url: string, width = 960): string {
  if (isCloudinaryUrl(url)) return withTransform(url, posterTransform(width), "jpg");
  const poster = videoDerivativeUrl(url, "poster");
  return poster ? cfImageUrl(poster, `width=${width},quality=60,format=auto,fit=scale-down`) : NO_POSTER;
}

/** The same still taken live from the video — for when the stored one fails to load. */
export function productVideoFramePoster(url: string, width = 960): string {
  if (isCloudinaryUrl(url)) return productVideoPoster(url, width);
  return cfMediaUrl(url, cfPoster(width)) ?? NO_POSTER;
}

/** A 1200x630 still of the video, cropped to fill — for og:image / Twitter cards. */
export function productVideoOgImage(url: string): string {
  if (isCloudinaryUrl(url)) return withTransform(url, "so_0,c_fill,w_1200,h_630,q_auto,f_jpg", "jpg");
  const poster = videoDerivativeUrl(url, "poster");
  return poster ? cfImageUrl(poster, "width=1200,height=630,fit=cover,format=jpeg") : NO_POSTER;
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
