import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { isAllowed } from "@/lib/permissions";
import { invalidatePromotions } from "@/lib/content-cache";
import { uploadImage } from "@/lib/cloudinary";
import { validateImageFile } from "@/lib/validate-image-upload";
import { setActivityMeta } from "@/features/activity/server/log-activity";
import {
  createPromotion,
  deletePromotion,
  getLivePromotions,
  listPromotions,
  personalizePromotions,
  promotionInputSchema,
  updatePromotion,
  visitorIdSchema,
} from "./promotions";

const unauthorized = { error: "Unauthorized" } as const;

const app = new Hono()
  // Public: what checkout and the storefront show. Short CDN cache; admin
  // writes invalidate the server-side list immediately.
  // With ?visitor=<id>, personal time limits are applied for that visitor (and
  // their "first seen" recorded), so that answer is private.
  .get("/live", zValidator("query", z.object({ visitor: visitorIdSchema.optional().catch(undefined) })), async (c) => {
    const { visitor } = c.req.valid("query");
    const shared = await getLivePromotions();
    const live = visitor ? await personalizePromotions(shared, visitor) : shared;
    c.header(
      "Cache-Control",
      visitor ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300",
    );
    // The product page ad runs in a sandboxed (opaque-origin) iframe and reads
    // this list to stay truthful; public data, no credentials, so * is safe.
    c.header("Access-Control-Allow-Origin", "*");
    return c.json({ promotions: live });
  })
  .get("/", sessionMiddleware, async (c) => {
    if (!isAllowed(c.get("user"), "promotions", "read", ["MODERATOR"])) return c.json(unauthorized, 403);
    try {
      return c.json({ promotions: await listPromotions() });
    } catch (err) {
      console.error("Promotions list failed:", err);
      return c.json({ error: "Failed to load promotions" }, 500);
    }
  })
  .post("/", sessionMiddleware, zValidator("json", promotionInputSchema), async (c) => {
    if (!isAllowed(c.get("user"), "promotions", "write", ["MODERATOR"])) return c.json(unauthorized, 403);
    try {
      const promotion = await createPromotion(c.req.valid("json"));
      setActivityMeta(c, { name: promotion.title });
      invalidatePromotions();
      return c.json({ promotion }, 201);
    } catch (err) {
      console.error("Promotion create failed:", err);
      return c.json({ error: "Failed to create promotion" }, 500);
    }
  })
  // Images for the product page ad. Admin only, like the ad code itself.
  .post("/upload-image", sessionMiddleware, async (c) => {
    if (c.get("user")?.role !== "ADMIN") return c.json(unauthorized, 403);
    try {
      const file = (await c.req.formData()).get("image");
      if (!(file instanceof File)) return c.json({ error: "No image file provided" }, 400);
      const check = validateImageFile(file);
      if (!check.ok) return c.json({ error: check.error }, 400);
      return c.json({ url: await uploadImage(file, "ads") });
    } catch (err) {
      console.error("Ad image upload failed:", err);
      return c.json({ error: "Failed to upload image" }, 500);
    }
  })
  .patch("/:id", sessionMiddleware, zValidator("json", promotionInputSchema), async (c) => {
    if (!isAllowed(c.get("user"), "promotions", "write", ["MODERATOR"])) return c.json(unauthorized, 403);
    try {
      const promotion = await updatePromotion(c.req.param("id"), c.req.valid("json"));
      if (!promotion) return c.json({ error: "Not found" }, 404);
      setActivityMeta(c, { name: promotion.title });
      invalidatePromotions();
      return c.json({ promotion });
    } catch (err) {
      console.error("Promotion update failed:", err);
      return c.json({ error: "Failed to update promotion" }, 500);
    }
  })
  .delete("/:id", sessionMiddleware, async (c) => {
    if (!isAllowed(c.get("user"), "promotions", "write", ["MODERATOR"])) return c.json(unauthorized, 403);
    try {
      const promotion = await deletePromotion(c.req.param("id"));
      if (!promotion) return c.json({ error: "Not found" }, 404);
      setActivityMeta(c, { name: promotion.title });
      invalidatePromotions();
      return c.json({ ok: true });
    } catch (err) {
      console.error("Promotion delete failed:", err);
      return c.json({ error: "Failed to delete promotion" }, 500);
    }
  });

export default app;
