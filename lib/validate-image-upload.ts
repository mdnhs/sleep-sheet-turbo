/**
 * Server-side guard for every image upload endpoint (products, blog,
 * categories). Before this, the only check was `file instanceof File` — no
 * MIME allowlist, no size cap (BAD-5, audit 2026-09-21). A request could
 * send an arbitrarily large or non-image file and it would be read fully
 * into memory (`arrayBuffer()`/`Buffer.from`) before Cloudinary ever saw it,
 * which is memory pressure this function pays for regardless of what
 * Cloudinary does with it afterward. Cloudinary's own `resource_type:
 * "image"` check happens only after that cost is already paid.
 *
 * Every upload route requires `*:write` on its module already, so this is
 * about resource limits and content-type hygiene for an authorized staff
 * upload, not public abuse — hence a generous 5MB cap rather than a strict
 * one.
 */
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type || "unknown"}` };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `File too large (max ${MAX_IMAGE_BYTES / (1024 * 1024)}MB)` };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty" };
  }
  return { ok: true };
}

/** Validates every File in a list; returns the first error found, if any. */
export function validateImageFiles(files: File[]): { ok: true } | { ok: false; error: string } {
  for (const file of files) {
    const result = validateImageFile(file);
    if (!result.ok) return result;
  }
  return { ok: true };
}
