import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { can } from "@/lib/permissions";
import { signR2VideoUpload, uploadImageToR2 } from "@/lib/media";
import { r2Configured, r2Delete, r2KeyFromUrl, r2List, r2PublicUrl } from "@/lib/r2";
import { getMediaProvider, getR2Config } from "@/lib/server-config";
import { validateImageFile } from "@/lib/validate-image-upload";
import { setActivityMeta } from "@/features/activity/server/log-activity";
import { MEDIA_UPLOAD_FOLDERS, type MediaItem } from "@/features/media/types";
import { mediaUsage } from "./usage";

// The R2 media library (Dashboard → Media). Read needs products:read; upload
// and delete need products:write — the same people who manage product images.

// Never shown or deletable from the library.
const HIDDEN_PREFIXES = ["_healthcheck/", "_e2e/"];

function kindOf(key: string): MediaItem["kind"] {
  if (/\.(jpe?g|png|webp|avif|gif|svg)$/i.test(key)) return "image";
  if (/\.(mp4|mov|webm)$/i.test(key)) return "video";
  return "other";
}

const unauthorized = { error: "Unauthorized" } as const;

const app = new Hono()
  .get("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!can(user, "products", "read")) return c.json(unauthorized, 403);

    const [config, provider] = await Promise.all([getR2Config(), getMediaProvider()]);
    if (!r2Configured(config)) {
      return c.json({ configured: false as const, provider, items: [] as MediaItem[], truncated: false });
    }
    const { objects, truncated } = await r2List();
    const visible = objects.filter((o) => !HIDDEN_PREFIXES.some((p) => o.key.startsWith(p)));
    const urls = visible.map((o) => r2PublicUrl(config.publicUrl, o.key));
    const usage = await mediaUsage(urls);
    const items: MediaItem[] = visible
      .map((o, i) => ({
        key: o.key,
        url: urls[i],
        folder: o.key.includes("/") ? o.key.slice(0, o.key.indexOf("/")) : "",
        name: o.key.slice(o.key.lastIndexOf("/") + 1),
        kind: kindOf(o.key),
        size: o.size,
        lastModified: o.lastModified,
        usedBy: usage.get(urls[i]) ?? [],
      }))
      .sort((a, b) => b.lastModified.localeCompare(a.lastModified));
    c.header("Cache-Control", "private, no-store");
    return c.json({ configured: true as const, provider, items, truncated });
  })

  .post("/upload", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!can(user, "products", "write")) return c.json(unauthorized, 403);

    const form = await c.req.formData();
    const folder = String(form.get("folder") ?? "library");
    if (!(MEDIA_UPLOAD_FOLDERS as readonly string[]).includes(folder)) return c.json({ error: "Unknown folder" }, 400);
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) return c.json({ error: "No files" }, 400);
    if (files.length > 20) return c.json({ error: "Upload at most 20 images at a time" }, 400);
    for (const file of files) {
      const valid = validateImageFile(file);
      if (!valid.ok) return c.json({ error: `${file.name}: ${valid.error}` }, 400);
    }
    if (!r2Configured(await getR2Config())) return c.json({ error: "R2 is not configured. Add it under Settings → CDN." }, 400);

    const urls: string[] = [];
    for (const file of files) urls.push(await uploadImageToR2(file, folder));
    setActivityMeta(c, { name: files.length === 1 ? files[0].name : `${files.length} images` });
    return c.json({ urls });
  })

  // Videos go straight from the browser to R2 with a presigned PUT (they're
  // too big for this server's request body); this only signs it.
  .post(
    "/video-ticket",
    sessionMiddleware,
    zValidator("json", z.object({ type: z.string().max(100), size: z.number().int().positive() })),
    async (c) => {
      const user = c.get("user");
      if (!can(user, "products", "write")) return c.json(unauthorized, 403);
      const result = await signR2VideoUpload(c.req.valid("json"));
      if (!result.ok) return c.json({ error: result.error }, 400);
      return c.json({ ticket: result.ticket });
    },
  )

  // Deleting a file that is still referenced breaks that page, so it needs
  // `force` and answers 409 with where each file is used otherwise.
  .post(
    "/delete",
    sessionMiddleware,
    zValidator("json", z.object({ urls: z.array(z.string().url()).min(1).max(200), force: z.boolean().optional() })),
    async (c) => {
      const user = c.get("user");
      if (!can(user, "products", "write")) return c.json(unauthorized, 403);
      const { urls, force } = c.req.valid("json");
      const { publicUrl } = await getR2Config();

      const keys = urls.map((url) => r2KeyFromUrl(url, publicUrl));
      if (keys.some((key) => !key || HIDDEN_PREFIXES.some((p) => key.startsWith(p)))) {
        return c.json({ error: "Not a media library file" }, 400);
      }
      if (!force) {
        const usage = await mediaUsage(urls);
        const inUse = urls.filter((url) => (usage.get(url) ?? []).length > 0).map((url) => ({ url, usedBy: usage.get(url)! }));
        if (inUse.length > 0) return c.json({ error: "Some files are still in use", inUse }, 409);
      }
      const results = await Promise.allSettled(keys.map((key) => r2Delete(key!)));
      const failed = urls.filter((_, i) => results[i].status === "rejected");
      setActivityMeta(c, { name: urls.length === 1 ? keys[0]! : `${urls.length} files` });
      if (failed.length) return c.json({ error: `${failed.length} file(s) could not be deleted`, failed }, 500);
      return c.json({ deleted: urls.length });
    },
  );

export default app;
