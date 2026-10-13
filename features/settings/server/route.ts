import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
import { sessionMiddleware } from "@/lib/session-middleware";
import { batch, db } from "@/db";
import { siteSettings } from "@/db/schema";
import { resetBkashTokenCache } from "@/lib/bkash";
import { can } from "@/lib/permissions";
import { setActivityMeta } from "@/features/activity/server/log-activity";
import { buildFallback } from "@/lib/build-phase";
import { purgeCdn } from "@/lib/cdn-purge";
import { cacheTag } from "@/lib/cache-tag";
import { SECRET_SETTING_KEYS } from "@/features/settings/secret-keys";
import { getSettingsKey } from "@/lib/settings/crypto";
import { decryptStoredMap } from "@/lib/settings/parse";
import { publicSettingsMap } from "@/lib/settings/public";
import { invalidateStoredSettings } from "@/lib/settings/read";
import { isSettingKey } from "@/lib/settings/registry";
import { planSettingsWrite } from "@/lib/settings/write";
import { testMediaStorage } from "@/lib/media";

/**
 * The public settings map (lib/settings/public.ts), wrapped in the Next data
 * cache under the "settings" tag the PATCH invalidates, so the read is shared
 * across requests instead of hitting Postgres on every CDN miss.
 */
const fetchPublicSettingsFromDb = async () => {
  try {
    const rows = await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
    return publicSettingsMap(rows);
  } catch (error) {
    // Empty only during the build; at runtime caching {} would hide the hero
    // and logo for a day (lib/build-phase.ts).
    return buildFallback<Record<string, string>>(error, {}, "settings");
  }
};

const getCachedPublicSettings = unstable_cache(fetchPublicSettingsFromDb, ["public-settings"], {
  revalidate: 86400,
  tags: [cacheTag("settings")],
});

const app = new Hono()

  .get("/", async (c) => {
    // ?fresh (the admin dashboard) bypasses the data cache, so a reload right
    // after a save shows the saved value.
    if (c.req.query("fresh")) {
      const map = await fetchPublicSettingsFromDb();
      c.header("Cache-Control", "no-store, no-cache, must-revalidate");
      return c.json(map);
    }
    // Called by useSettings() on every storefront page. The PATCH drops this
    // entry with revalidateTag, so the long timer costs no freshness.
    const map = await getCachedPublicSettings();
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    return c.json(map);
  })

  // ADMIN-only (BAD-16, audit 2026-09-21): raw third-party credentials,
  // decrypted for display in the admin forms.
  .get("/secrets", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "ADMIN") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const rows = await db.query.siteSettings.findMany({
      where: inArray(siteSettings.key, [...SECRET_SETTING_KEYS]),
    });
    const decrypted = decryptStoredMap(Object.fromEntries(rows.map((r) => [r.key, r.value])), getSettingsKey());
    return c.json(Object.fromEntries(SECRET_SETTING_KEYS.map((key) => [key, decrypted[key] ?? ""])));
  })

  // ADMIN-only: Settings → CDN "Test connection". Writes, reads back and
  // deletes a test file with the saved credentials of the selected provider.
  .post("/media/test", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "ADMIN") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return c.json(await testMediaStorage());
  })

  // Validated against lib/settings/registry.ts by planSettingsWrite: unknown
  // keys 400, admin-only keys 403 below ADMIN, invalid values 400 naming the key.
  .patch("/", sessionMiddleware, zValidator("json", z.record(z.string(), z.unknown())), async (c) => {
    const user = c.get("user");
    if (!can(user, "settings", "write")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const keys = Object.keys(body).filter(isSettingKey);
    const before = keys.length
      ? Object.fromEntries(
          (await db.query.siteSettings.findMany({ where: inArray(siteSettings.key, keys) })).map((r) => [r.key, r.value]),
        )
      : {};

    const plan = planSettingsWrite(body, user, before, getSettingsKey());
    if (!plan.ok) return c.json(plan.body, plan.status);

    // Nothing changed: no write, no activity-log entry, no revalidation, and
    // above all no whole-CDN purge.
    if (plan.rows.length === 0) return c.json({ success: true });

    // All upserts in one transaction, so a failure saves none of them.
    await batch((tx) =>
      plan.rows.map(({ key, value }) =>
        tx
          .insert(siteSettings)
          .values({ key, value })
          .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } }),
      ),
    );

    invalidateStoredSettings();
    // A changed credential/mode must not keep serving the old bKash token.
    resetBkashTokenCache();

    setActivityMeta(c, {
      name: plan.changes.length === 1 ? plan.changes[0].label : `${plan.changes.length} settings`,
      changes: plan.changes,
    });

    try {
      // expire 0, not a named profile: see lib/meta-catalog/cache.ts.
      revalidateTag(cacheTag("settings"), { expire: 0 });
      for (const group of plan.groups) revalidateTag(cacheTag("settings", group), { expire: 0 });
    } catch {
      /* Ignore if called outside Next request context */
    }
    // Hero, logo and banners are baked into edge-cached HTML.
    purgeCdn();

    return c.json({ success: true });
  });

export default app;
