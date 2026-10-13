// Client-safe URL helpers for stored media. Two kinds of stored URL exist
// while the store moves off Cloudinary:
//
// - res.cloudinary.com URLs, transformed by Cloudinary itself (URL segments).
// - R2 URLs (the bucket's public domain), which R2 serves as-is. Resizing and
//   format negotiation for those come from Cloudflare Image / Media
//   Transformations on the storefront's own zone:
//   `<origin>/cdn-cgi/image/<options>/<source URL>`.
//
// NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN is that zone's origin (e.g.
// https://sleepsheetbd.com). It is read at call time, not module load, so
// tests can stub it. Unset (local dev, where no Cloudflare zone sits in
// front), R2 URLs are served untransformed.

const CDN_CGI_IMAGE = "/cdn-cgi/image/";
const CDN_CGI_MEDIA = "/cdn-cgi/media/";

export function mediaTransformOrigin(): string {
  return (process.env.NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN || "").replace(/\/+$/, "");
}

export function isCloudinaryUrl(url: string): boolean {
  return url.startsWith("https://res.cloudinary.com/");
}

/**
 * The source URL inside a `/cdn-cgi/image/<options>/<source>` URL, or the
 * input unchanged. Lets a URL that was already wrapped (getOptimizedImageUrl
 * feeding next/image's loader) be re-wrapped with new options instead of
 * nested.
 */
export function unwrapCfImageUrl(url: string): string {
  const i = url.indexOf(CDN_CGI_IMAGE);
  if (i === -1) return url;
  const rest = url.slice(i + CDN_CGI_IMAGE.length);
  const slash = rest.indexOf("/");
  return slash === -1 ? url : rest.slice(slash + 1);
}

/**
 * An R2 (or any non-Cloudinary https) image through Cloudflare Image
 * Transformations. `options` is the comma-separated option list, e.g.
 * "width=640,quality=85,format=auto,fit=scale-down".
 */
export function cfImageUrl(src: string, options: string): string {
  const source = unwrapCfImageUrl(src);
  const origin = mediaTransformOrigin();
  // A video still (/cdn-cgi/media/…) is already sized for its slot.
  if (!origin || !source.startsWith("https://") || source.includes(CDN_CGI_MEDIA)) return source;
  return `${origin}${CDN_CGI_IMAGE}${options}/${source}`;
}

/** A video (or a still from it) through Cloudflare Media Transformations. */
export function cfMediaUrl(src: string, options: string): string | null {
  const origin = mediaTransformOrigin();
  if (!origin || !src.startsWith("https://")) return null;
  return `${origin}${CDN_CGI_MEDIA}${options}/${src}`;
}
