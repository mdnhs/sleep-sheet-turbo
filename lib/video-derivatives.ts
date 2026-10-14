import { cfMediaUrl, mediaTransformOrigin } from "@/lib/media-url"
import { VIDEO_DERIVATIVES, isProductVideoKey, videoDerivativeKey, type VideoDerivative } from "@/lib/product-video"
import { r2Delete, r2Exists, r2KeyFromUrl, r2Put } from "@/lib/r2"
import { getR2Config } from "@/lib/server-config"

// Generates the stored delivery files of an R2 product video (poster still,
// 720px and 480px MP4 — see VIDEO_DERIVATIVES in lib/product-video.ts) by
// asking Cloudflare Media Transformations for each once and writing the
// result back to the bucket. Called right after an upload, again (as a
// safety net) when a product is saved, and by the backfill script.

const KINDS = Object.keys(VIDEO_DERIVATIVES) as VideoDerivative[]

// A first-time transcode of a ~60MB upload can take a while.
const TRANSFORM_TIMEOUT_MS = 90_000

export type DerivativesResult = { ok: true; made: VideoDerivative[] } | { ok: false; error: string }

async function videoKeyOf(url: string): Promise<string | null> {
  const { publicUrl } = await getR2Config()
  const key = publicUrl ? r2KeyFromUrl(url, publicUrl) : null
  return key && isProductVideoKey(key) ? key : null
}

/** Makes whichever derivatives of an R2 product video are missing. Idempotent. */
export async function ensureVideoDerivatives(url: string): Promise<DerivativesResult> {
  const key = await videoKeyOf(url)
  if (!key) return { ok: false, error: "Not a product video in this store's R2 bucket" }
  if (!mediaTransformOrigin()) return { ok: false, error: "No media transform origin is set" }

  // In parallel: each one is a separate transcode on Cloudflare's side.
  const results = await Promise.allSettled(
    KINDS.map(async (kind) => {
      const target = videoDerivativeKey(key, kind)!
      if (await r2Exists(target)) return null
      const { transform, type } = VIDEO_DERIVATIVES[kind]
      const res = await fetch(cfMediaUrl(url, transform)!, {
        cache: "no-store",
        signal: AbortSignal.timeout(TRANSFORM_TIMEOUT_MS),
      })
      const got = res.headers.get("content-type") ?? ""
      if (!res.ok || got !== type) throw new Error(`${kind}: transform answered ${res.status} ${got}`)
      await r2Put(target, Buffer.from(await res.arrayBuffer()), type)
      return kind
    }),
  )

  const failed = results.flatMap((r) => (r.status === "rejected" ? [String((r.reason as Error)?.message ?? r.reason)] : []))
  if (failed.length) return { ok: false, error: failed.join("; ") }
  return { ok: true, made: results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : [])) }
}

/** Best effort, for after a response: logs instead of throwing. */
export async function ensureVideoDerivativesQuietly(url: string): Promise<void> {
  try {
    const result = await ensureVideoDerivatives(url)
    if (!result.ok) console.error(`Video derivatives for ${url}: ${result.error}`)
  } catch (error) {
    console.error(`Video derivatives for ${url}:`, error)
  }
}

/** The stored derivatives of a video key, removed alongside the video itself. */
export async function deleteVideoDerivatives(videoKey: string): Promise<void> {
  if (!isProductVideoKey(videoKey)) return
  await Promise.all(KINDS.map((kind) => r2Delete(videoDerivativeKey(videoKey, kind)!)))
}
