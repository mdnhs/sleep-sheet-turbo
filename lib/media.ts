import { randomBytes } from "node:crypto"
import sharp from "sharp"
import * as cloudinary from "@/lib/cloudinary"
import { isCloudinaryUrl } from "@/lib/media-url"
import {
  PRODUCT_VIDEO_FOLDER,
  PRODUCT_VIDEO_MAX_BYTES,
  PRODUCT_VIDEO_R2_TYPES,
  isCloudinaryVideoUrl,
  isR2VideoUrl,
  type ProductVideoR2Type,
} from "@/lib/product-video"
import { r2Configured, r2Delete, r2KeyFromUrl, r2PresignPut, r2Put, r2PublicUrl } from "@/lib/r2"
import { getCloudinaryConfig, getMediaProvider, getR2Config } from "@/lib/server-config"

// Server-side media storage. New uploads go to the provider chosen in
// Settings → CDN (media_provider); deleting and validating go by the stored
// URL itself, so Cloudinary and R2 URLs both keep working while the store
// moves between them.

function newObjectName(): string {
  return randomBytes(12).toString("base64url")
}

// Cloudinary applies an incoming 1600px / q_auto:good transformation (see
// lib/cloudinary.ts); R2 stores bytes as given, so the same limit happens
// here. JPEG for opaque images and PNG where transparency matters — not
// WebP, because the invoice PDF renderer can't read it. Delivery still gets
// AVIF/WebP via format=auto (lib/media-url.ts). GIFs are kept as uploaded so
// an animation survives.
const KEEPABLE: Record<string, { ext: string; type: string }> = {
  jpeg: { ext: "jpg", type: "image/jpeg" },
  png: { ext: "png", type: "image/png" },
  webp: { ext: "webp", type: "image/webp" },
  avif: { ext: "avif", type: "image/avif" },
}

async function optimizeImage(input: Buffer): Promise<{ data: Buffer; ext: string; type: string }> {
  const meta = await sharp(input).metadata()
  if (meta.format === "gif") return { data: input, ext: "gif", type: "image/gif" }

  const resized = sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
  const { isOpaque } = await sharp(input).stats()
  const out = isOpaque
    ? { data: await resized.jpeg({ quality: 82, mozjpeg: true }).toBuffer(), ext: "jpg", type: "image/jpeg" }
    : { data: await resized.png({ compressionLevel: 9 }).toBuffer(), ext: "png", type: "image/png" }

  // An already-small, well-compressed file (a flat logo PNG) can come out
  // bigger; keep the original then.
  const original = meta.format ? KEEPABLE[meta.format] : undefined
  const withinLimit = (meta.width ?? Infinity) <= 1600 && (meta.height ?? Infinity) <= 1600
  if (original && withinLimit && out.data.length >= input.length) return { data: input, ...original }
  return out
}

export async function uploadImage(file: File | Buffer, folder = "categories"): Promise<string> {
  if ((await getMediaProvider()) !== "r2") return cloudinary.uploadImage(file, folder)
  return uploadImageToR2(file, folder)
}

/** R2 regardless of media_provider — the media library manages R2 only. */
export async function uploadImageToR2(file: File | Buffer, folder: string): Promise<string> {
  const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file
  const { data, ext, type } = await optimizeImage(buffer)
  return r2Put(`${folder}/${newObjectName()}.${ext}`, data, type)
}

/**
 * True where MEDIA_STORAGE_READONLY=1 — the preview app, whose database is a
 * copy of production's while the R2 bucket and Cloudinary cloud are the same
 * ones. Whether a file is still in use is judged against this environment's
 * database only, so a delete here could remove a file production still
 * shows. Deletes then become no-ops; uploads still work.
 */
export function mediaDeletesDisabled(): boolean {
  return process.env.MEDIA_STORAGE_READONLY === "1"
}

export async function deleteImage(url: string): Promise<void> {
  if (!url.startsWith("https://")) return
  if (mediaDeletesDisabled()) return
  if (isCloudinaryUrl(url)) return cloudinary.deleteImage(url)

  const key = r2KeyFromUrl(url, (await getR2Config()).publicUrl)
  if (key) await r2Delete(key)
}

export type VideoUploadTicket =
  | { provider: "cloudinary"; cloudName: string; apiKey: string; signature: string; params: Record<string, string | number> }
  | { provider: "r2"; uploadUrl: string; headers: Record<string, string>; publicUrl: string }

/**
 * Step 1 of a direct browser video upload, for the current provider. R2
 * needs the file's type and size up front: both are signed into the URL.
 */
export async function signVideoUpload(
  file: { type: string; size: number },
): Promise<{ ok: true; ticket: VideoUploadTicket } | { ok: false; error: string }> {
  if ((await getMediaProvider()) !== "r2") {
    const signed = await cloudinary.signProductVideoUpload()
    if (!signed) return { ok: false, error: "Cloudinary is not configured. Add it under Settings → CDN." }
    return { ok: true, ticket: { provider: "cloudinary", ...signed } }
  }

  return signR2VideoUpload(file)
}

/** A presigned R2 PUT for one product video, regardless of media_provider. */
export async function signR2VideoUpload(
  file: { type: string; size: number },
): Promise<{ ok: true; ticket: VideoUploadTicket } | { ok: false; error: string }> {
  if (!r2Configured(await getR2Config())) {
    return { ok: false, error: "R2 is not configured. Add it under Settings → CDN." }
  }
  const ext = PRODUCT_VIDEO_R2_TYPES[file.type as ProductVideoR2Type]
  if (!ext) return { ok: false, error: "Upload an MP4 or MOV (H.264) video." }
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > PRODUCT_VIDEO_MAX_BYTES) {
    return { ok: false, error: `Video must be under ${PRODUCT_VIDEO_MAX_BYTES / (1024 * 1024)}MB.` }
  }
  const key = `${PRODUCT_VIDEO_FOLDER}/${newObjectName()}.${ext}`
  return { ok: true, ticket: { provider: "r2", ...(await r2PresignPut(key, file.type, file.size)) } }
}

/** A product video URL from a form field is only accepted from this store's own storage. */
export async function isOwnVideoUrl(url: string): Promise<boolean> {
  if (isCloudinaryUrl(url)) return isCloudinaryVideoUrl(url, (await getCloudinaryConfig()).cloudName)
  const { publicUrl } = await getR2Config()
  return Boolean(publicUrl) && isR2VideoUrl(url, publicUrl)
}

export async function deleteVideo(url: string): Promise<void> {
  if (mediaDeletesDisabled()) return
  if (isCloudinaryUrl(url)) return cloudinary.deleteVideo(url)

  const key = r2KeyFromUrl(url, (await getR2Config()).publicUrl)
  if (key) await r2Delete(key)
}

export type MediaTestStep = { label: string; ok: boolean; detail: string }

/**
 * Settings → CDN "Test connection": proves the saved credentials for the
 * selected provider can actually write, serve and delete — a key that can
 * authenticate but not upload (Cloudinary's 403 "missing permissions") fails
 * here instead of on the next product save.
 */
export async function testMediaStorage(): Promise<{ provider: "cloudinary" | "r2"; ok: boolean; steps: MediaTestStep[] }> {
  const provider = await getMediaProvider()
  if (provider !== "r2") {
    const result = await cloudinary.testCloudinaryUpload()
    return { provider, ok: result.ok, steps: [{ label: "Upload + delete", ...result }] }
  }

  const steps: MediaTestStep[] = []
  const done = () => ({ provider, ok: steps.every((s) => s.ok), steps })
  const config = await getR2Config()
  if (!r2Configured(config)) {
    steps.push({ label: "Settings", ok: false, detail: "Account ID, bucket, public URL, access key and secret are all required." })
    return done()
  }

  const key = `_healthcheck/${newObjectName()}.txt`
  const marker = `sleep-sheet r2 check ${new Date().toISOString()}`
  try {
    await r2Put(key, marker, "text/plain")
    steps.push({ label: "Upload", ok: true, detail: "Wrote a test file to the bucket." })
  } catch (error) {
    steps.push({ label: "Upload", ok: false, detail: (error as Error).message })
    return done()
  }

  const url = r2PublicUrl(config.publicUrl, key)
  try {
    const res = await fetch(url, { cache: "no-store" })
    const ok = res.ok && (await res.text()) === marker
    steps.push({
      label: "Public URL",
      ok,
      detail: ok ? `Served from ${config.publicUrl}.` : `${url} answered ${res.status}. Is public access on for this domain?`,
    })
  } catch (error) {
    steps.push({ label: "Public URL", ok: false, detail: `${url}: ${(error as Error).message}` })
  }

  try {
    await r2Delete(key)
    steps.push({ label: "Delete", ok: true, detail: "Removed the test file." })
  } catch (error) {
    steps.push({ label: "Delete", ok: false, detail: (error as Error).message })
  }
  return done()
}
