import { v2 as cloudinary } from "cloudinary"
import { getCloudinaryConfig } from "@/lib/server-config"
import {
  PRODUCT_VIDEO_FOLDER,
  PRODUCT_VIDEO_FORMATS,
  PRODUCT_VIDEO_TRANSFORM,
  productVideoPublicId,
} from "@/lib/product-video"

// This is an *incoming* transformation: Cloudinary applies it before saving
// the asset, so we do not keep an unnecessarily large original alongside the
// versions served to customers. `q_auto:good` is content-aware compression
// (not a fixed, potentially damaging JPEG quality), while `c_limit` preserves
// the entire image and only downsizes sources larger than 1600px on either
// axis. For product photography this keeps most uploaded assets in the
// 150–300 KB range without artificially inflating images that compress below
// 150 KB. We intentionally do not use `f_auto` here: that choice must happen at
// delivery time for each browser and is already handled by image-loader.ts.
const UPLOAD_OPTIMIZATION = {
  width: 1600,
  height: 1600,
  crop: "limit",
  quality: "auto:good",
} as const

async function ensureConfigured() {
  const config = await getCloudinaryConfig()
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
  })
}

export async function uploadImage(file: File | Buffer, folder = "categories"): Promise<string> {
  await ensureConfigured()
  const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: UPLOAD_OPTIMIZATION,
      },
      (error, result) => {
        if (error) reject(new Error(error.message))
        else resolve(result!.secure_url)
      }
    )
    stream.end(buffer)
  })
}

export async function deleteImage(url: string): Promise<void> {
  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) return

  await ensureConfigured()
  const parts = url.split("/")
  const folderAndFile = parts.slice(parts.indexOf("upload") + 2).join("/")
  const publicId = folderAndFile.replace(/\.[^.]+$/, "")

  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error) => {
      if (error) reject(new Error(error.message))
      else resolve()
    })
  })
}

/**
 * Signs a direct browser -> Cloudinary video upload. Videos are too big for a
 * serverless function's request body, so the admin form posts the file to
 * Cloudinary itself; this hands it a short-lived signature (the API secret
 * never leaves the server). The signed params pin the folder, the allowed
 * formats and the pre-generated compressed rendition, so a leaked signature
 * can't be used to upload anything else or anywhere else.
 */
export async function signProductVideoUpload() {
  const config = await getCloudinaryConfig()
  if (!config.cloudName || !config.apiKey || !config.apiSecret) return null

  const timestamp = Math.round(Date.now() / 1000)
  const params = {
    allowed_formats: PRODUCT_VIDEO_FORMATS.join(","),
    eager: PRODUCT_VIDEO_TRANSFORM,
    eager_async: "true",
    folder: PRODUCT_VIDEO_FOLDER,
    timestamp,
  }
  const signature = cloudinary.utils.api_sign_request(params, config.apiSecret)

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    signature,
    params,
  }
}

export async function deleteVideo(url: string): Promise<void> {
  const publicId = productVideoPublicId(url)
  if (!publicId) return

  await ensureConfigured()
  await cloudinary.uploader.destroy(publicId, { resource_type: "video", invalidate: true })
}

const PROBE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

/**
 * Uploads and deletes a 1px image with the saved credentials. A plain signed
 * fetch rather than the SDK: on a refusal Cloudinary puts the reason (e.g. a
 * key whose role lacks "create") in the x-cld-error header, which the SDK
 * reduces to "Server returned unexpected status code - 403".
 */
export async function testCloudinaryUpload(): Promise<{ ok: boolean; detail: string }> {
  const config = await getCloudinaryConfig()
  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    return { ok: false, detail: "Cloud name, API key and API secret are required." }
  }
  const params = { folder: "_healthcheck", timestamp: Math.round(Date.now() / 1000) }
  const body = new FormData()
  body.set("file", PROBE_PNG)
  body.set("api_key", config.apiKey)
  body.set("signature", cloudinary.utils.api_sign_request(params, config.apiSecret))
  for (const [key, value] of Object.entries(params)) body.set(key, String(value))

  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {
    method: "POST",
    body,
  })
  if (!res.ok) {
    return { ok: false, detail: `Upload refused (${res.status}): ${res.headers.get("x-cld-error") || res.statusText}` }
  }
  const { public_id } = (await res.json()) as { public_id: string }
  try {
    await ensureConfigured()
    await cloudinary.uploader.destroy(public_id)
  } catch (error) {
    return { ok: false, detail: `Uploaded, but deleting the test image failed: ${(error as Error).message}` }
  }
  return { ok: true, detail: "Uploaded and deleted a test image." }
}
