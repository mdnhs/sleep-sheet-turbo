import { AwsClient, AwsV4Signer } from "aws4fetch"
import { getR2Config } from "@/lib/server-config"

// Cloudflare R2 over its S3-compatible API, signed with aws4fetch (SigV4).
// Objects are written with the account's API token and read back by anyone
// through the bucket's public URL (r2_public_url).

// Uploaded keys are random, so an object never changes after it is written.
export const R2_IMMUTABLE = "public, max-age=31536000, immutable"

type R2Config = Awaited<ReturnType<typeof getR2Config>>

export function r2Configured(config: R2Config): boolean {
  return Boolean(config.accountId && config.bucket && config.publicUrl && config.accessKeyId && config.secretAccessKey)
}

async function requireConfig(): Promise<R2Config> {
  const config = await getR2Config()
  if (!r2Configured(config)) throw new Error("R2 is not configured. Add it under Settings → CDN.")
  return config
}

function objectEndpoint(config: R2Config, key: string): string {
  const path = key.split("/").map(encodeURIComponent).join("/")
  return `https://${config.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(config.bucket)}/${path}`
}

function client(config: R2Config): AwsClient {
  return new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  })
}

/**
 * Signs with aws4fetch but sends the original bytes ourselves. AwsClient.fetch
 * hands fetch a Request object, whose body is a stream; inside the Next.js
 * server that goes out chunked with no Content-Length, which R2 rejects
 * (411 MissingContentLength). A plain byte body keeps its length.
 */
async function signedFetch(
  config: R2Config,
  url: string,
  init: { method: string; body?: Uint8Array<ArrayBuffer>; headers?: Record<string, string> },
): Promise<Response> {
  const signed = await client(config).sign(url, { method: init.method, headers: init.headers, body: init.body })
  return fetch(signed.url, { method: init.method, headers: signed.headers, body: init.body, cache: "no-store" })
}

async function failure(res: Response, action: string): Promise<Error> {
  const body = await res.text().catch(() => "")
  const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1]
  const message = body.match(/<Message>([^<]+)<\/Message>/)?.[1]
  return new Error(`R2 ${action} failed (${res.status}${code ? ` ${code}` : ""})${message ? `: ${message}` : ""}`)
}

/** The public URL an object is served from. */
export function r2PublicUrl(publicUrl: string, key: string): string {
  return `${publicUrl.replace(/\/+$/, "")}/${key}`
}

/** The object key behind a public URL of this bucket, or null if it isn't one. */
export function r2KeyFromUrl(url: string, publicUrl: string): string | null {
  const base = publicUrl.replace(/\/+$/, "")
  if (!base || !url.startsWith(`${base}/`)) return null
  const key = url.slice(base.length + 1).split(/[?#]/)[0]
  if (!key || key.split("/").some((part) => part === "" || part === "." || part === "..")) return null
  return decodeURIComponent(key)
}

export async function r2Put(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
): Promise<string> {
  const config = await requireConfig()
  const res = await signedFetch(config, objectEndpoint(config, key), {
    method: "PUT",
    body: typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body),
    headers: { "Content-Type": contentType, "Cache-Control": R2_IMMUTABLE },
  })
  if (!res.ok) throw await failure(res, "upload")
  return r2PublicUrl(config.publicUrl, key)
}

export async function r2Delete(key: string): Promise<void> {
  const config = await requireConfig()
  const res = await signedFetch(config, objectEndpoint(config, key), { method: "DELETE" })
  // S3 DELETE is idempotent: a missing object is 204 too.
  if (!res.ok && res.status !== 404) throw await failure(res, "delete")
}

/**
 * A presigned PUT for a direct browser upload. Content-Type, Content-Length
 * and Cache-Control are signed, so the URL only accepts exactly the declared
 * file type and size — a leaked URL can't be used to store anything bigger
 * or different. The browser sends Content-Length itself; the other two
 * headers it must send exactly as returned.
 */
export async function r2PresignPut(
  key: string,
  contentType: string,
  contentLength: number,
  expiresInSeconds = 600,
): Promise<{ uploadUrl: string; headers: Record<string, string>; publicUrl: string }> {
  const config = await requireConfig()
  const headers = { "Content-Type": contentType, "Cache-Control": R2_IMMUTABLE }
  const signer = new AwsV4Signer({
    url: `${objectEndpoint(config, key)}?X-Amz-Expires=${expiresInSeconds}`,
    method: "PUT",
    headers: { ...headers, "Content-Length": String(contentLength) },
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    signQuery: true,
    allHeaders: true,
  })
  const signed = await signer.sign()
  return { uploadUrl: signed.url.toString(), headers, publicUrl: r2PublicUrl(config.publicUrl, key) }
}
