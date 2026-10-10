import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { batch, db } from "@/db";
import { invalidateSettingsCache } from "@/lib/settings-cache";
import { resetBkashTokenCache } from "@/lib/bkash";
import { isValidSocialManagerUrl } from "@/lib/social-manager";
import { siteSettings } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { can } from "@/lib/permissions";
import { setActivityMeta, type ActivityChange } from "@/features/activity/server/log-activity";
import { revalidateTag, unstable_cache } from "next/cache";
import { buildFallback } from "@/lib/build-phase";
import { purgeCdn } from "@/lib/cdn-purge";

// Credentials that must never leave the server through the public GET.
// The public endpoint exposes only a "<key>_set" flag for each so the admin
// UI can show configured state; raw values are served by /secrets below.
// (cloudinary_cloud_name stays public — it is visible in every image URL.)
const SECRET_SETTING_KEYS = [
  "steadfast_api_key",
  "steadfast_secret_key",
  "bdcourier_api_key",
  "cloudinary_api_key",
  "cloudinary_api_secret",
  "google_sheets_client_email",
  "google_sheets_private_key",
  "google_sheets_spreadsheet_id",
  "bkash_app_key",
  "bkash_app_secret",
  "bkash_username",
  "bkash_password",
] as const;

// Safety net for credential-shaped rows that aren't in the list above (the
// DB contains orphaned logins like fraud_steadfast_* / fraud_pathao_* from
// older versions). Anything matching this never leaves the public GET.
const SECRET_KEY_PATTERN = /password|secret|api_key|token|_pass$|^fraud_/i;

const isSecretKey = (key: string) =>
  (SECRET_SETTING_KEYS as readonly string[]).includes(key) ||
  SECRET_KEY_PATTERN.test(key);

/**
 * The public settings map — every non-secret row, plus a `<key>_set` flag for
 * each credential so the admin UI can show configured state without the value.
 *
 * Wrapped in the Next data cache under the same "settings" tag the PATCH
 * invalidates, so the read is shared across requests and across instances
 * instead of hitting Postgres on every CDN miss.
 */
const fetchPublicSettingsFromDb = async () => {
  try {
    const settings = await db.select().from(siteSettings);
    const map: Record<string, string> = {};
    const secretValues: Record<string, string> = {};
    for (const { key, value } of settings) {
      if (isSecretKey(key)) secretValues[key] = value;
      else map[key] = value;
    }
    for (const key of SECRET_SETTING_KEYS) {
      map[`${key}_set`] = secretValues[key] ? "true" : "false";
    }
    return map;
  } catch (error) {
    // Empty only during the build; at runtime caching {} would hide the hero
    // and logo for a day (lib/build-phase.ts).
    return buildFallback<Record<string, string>>(error, {}, "settings");
  }
};

const getCachedPublicSettings = unstable_cache(
  fetchPublicSettingsFromDb,
  ["public-settings"],
  { revalidate: 86400, tags: ["settings"] },
);

const app = new Hono()

  .get("/", async (c) => {
    // If the request passes ?fresh=... (e.g. from admin dashboard), bypass Next.js Data Cache
    // and query Postgres directly, with no-store cache control headers.
    const isFresh = Boolean(c.req.query("fresh"));
    if (isFresh) {
      const map = await fetchPublicSettingsFromDb();
      c.header("Cache-Control", "no-store, no-cache, must-revalidate");
      return c.json(map);
    }

    // Cached across requests, not just at the CDN.
    //
    // This endpoint is called by useSettings() from the client layout — via
    // google-analytics.tsx and seo-verification.tsx — so it runs on every
    // storefront page view. The CDN absorbs most of that, but s-maxage=300
    // still lets one request per five minutes *per edge region* through to
    // the origin, and each one used to run `db.select()` against a sleeping
    // database. Neon bills a five-minute minimum every time the compute
    // wakes, so a table that changes a few times a month was keeping it
    // awake through the whole trading day.
    //
    // A long revalidate costs nothing in freshness: the PATCH below calls
    // revalidateTag("settings", { expire: 0 }), so an admin edit drops this
    // entry immediately. The timer is only the fallback for changes that
    // bypass that path (a direct DB edit, a seed script).
    const map = await getCachedPublicSettings();
    c.header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    return c.json(map);
  })

  // Admin-only: returns the raw credential values so a logged-in admin can
  // view and edit them. Kept off the public GET above.
  .get("/secrets", sessionMiddleware, async (c) => {
    const user = c.get("user");
    // ADMIN-only, not just settings:read (BAD-16, audit 2026-09-21): this
    // returns raw third-party credentials (Steadfast, Cloudinary, Google
    // Sheets). `settings:read` is a granular permission a non-admin staff
    // role can hold to view store configuration — it was never meant to
    // include reading live API secrets, and nothing else in this codebase
    // hands out credentials to anyone below ADMIN (see the same reasoning
    // on api-keys' requireAdmin()).
    if (!user || user.role !== "ADMIN") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const rows = await db.query.siteSettings.findMany({
      where: inArray(siteSettings.key, [...SECRET_SETTING_KEYS]),
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const secrets = Object.fromEntries(
      SECRET_SETTING_KEYS.map((key) => [key, byKey[key] ?? ""]),
    ) as Record<(typeof SECRET_SETTING_KEYS)[number], string>;
    return c.json(secrets);
  })

  .patch(
    "/",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        shipping_inside_dhaka: z.coerce.number().min(0).optional(),
        shipping_outside_dhaka: z.coerce.number().min(0).optional(),
        currency: z.string().min(1).max(10).optional(),
        payment_method_card: z.enum(["true", "false"]).optional(),
        payment_method_cod: z.enum(["true", "false"]).optional(),
        payment_method_due: z.enum(["true", "false"]).optional(),
        payment_method_bkash: z.enum(["true", "false"]).optional(),
        // Where the self-hosted social scheduler lives; opened from the admin
        // sidebar. http(s) only so it can never be a javascript: link.
        social_manager_url: z
          .string()
          .trim()
          .refine(isValidSocialManagerUrl, "Must be an http(s) URL")
          .optional(),
        bkash_mode: z.enum(["sandbox", "live"]).optional(),
        bkash_app_key: z.string().trim().optional(),
        bkash_app_secret: z.string().trim().optional(),
        bkash_username: z.string().trim().optional(),
        bkash_password: z.string().trim().optional(),
        pos_payment_methods: z.string().optional(),
        pos_facebook_pages: z.string().optional(),
        pos_default_facebook_page: z.string().optional(),
        seo_site_name: z.string().optional(),
        seo_default_title: z.string().optional(),
        seo_default_description: z.string().optional(),
        seo_default_image: z.string().optional(),
        seo_google_verification: z.string().optional(),
        seo_bing_verification: z.string().optional(),
        google_analytics_id: z.string().optional(),
        ga4_property_id: z.string().optional(),
        gtm_web_id: z.string().optional(),
        gtm_server_id: z.string().optional(),
        gtm_server_url: z.string().optional(),
        // First-party web analytics on/off (features/web-analytics). Missing
        // means on; only "false" stops /api/t and order attribution.
        analytics_enabled: z.enum(["true", "false"]).optional(),
        seo_twitter_handle: z.string().optional(),
        seo_robots_ai_block: z.enum(["true", "false"]).optional(),
        cloudinary_cloud_name: z.string().optional(),
        cloudinary_api_key: z.string().optional(),
        cloudinary_api_secret: z.string().optional(),
        steadfast_api_key: z.string().optional(),
        steadfast_secret_key: z.string().optional(),
        bdcourier_api_key: z.string().optional(),
        google_sheets_client_email: z.string().optional(),
        google_sheets_private_key: z.string().optional(),
        google_sheets_spreadsheet_id: z.string().optional(),
        site_name: z.string().optional(),
        logo_url: z.string().optional(),
        hero_title: z.string().optional(),
        hero_subtitle: z.string().optional(),
        hero_cta_text: z.string().optional(),
        hero_cta_link: z.string().optional(),
        hero_bg_image: z.string().optional(),
        hero_slides: z.string().optional(),
        promo_banners: z.string().optional(),
        feature_1_title: z.string().optional(),
        feature_1_desc: z.string().optional(),
        feature_2_title: z.string().optional(),
        feature_2_desc: z.string().optional(),
        feature_3_title: z.string().optional(),
        feature_3_desc: z.string().optional(),
        feature_4_title: z.string().optional(),
        feature_4_desc: z.string().optional(),
        newsletter_title: z.string().optional(),
        newsletter_subtitle: z.string().optional(),
        footer_brand_desc: z.string().optional(),
        footer_email: z.string().optional(),
        footer_phone: z.string().optional(),
        footer_address: z.string().optional(),
        footer_address_link: z.string().optional(),
        social_facebook: z.string().optional(),
        social_instagram: z.string().optional(),
        social_twitter: z.string().optional(),
        social_youtube: z.string().optional(),
        social_tiktok: z.string().optional(),
        footer_copyright: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!can(user, "settings", "write")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const body = c.req.valid("json");
      const updates = Object.entries(body).filter(([, v]) => v !== undefined) as [string, string | number][];

      const changedKeys = updates.map(([key]) => key);
      const before = changedKeys.length
        ? await db.query.siteSettings.findMany({ where: inArray(siteSettings.key, changedKeys) })
        : [];
      const beforeByKey = Object.fromEntries(before.map((r) => [r.key, r.value]));

      // All upserts in one transaction, so a failure saves none of them.
      if (updates.length > 0) {
        await batch((tx) =>
          updates.map(([key, value]) =>
            tx.insert(siteSettings)
              .values({ key, value: String(value) })
              .onConflictDoUpdate({
                target: siteSettings.key,
                set: { value: String(value), updatedAt: new Date() },
              })
          )
        );
      }

      // The in-process settings cache now holds stale values.
      invalidateSettingsCache();
      // A changed credential/mode must not keep serving the old bKash token.
      resetBkashTokenCache();

      // Never log raw secret values — show only that a credential changed.
      const prettifyKey = (key: string) =>
        key.split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
      const changes: ActivityChange[] = updates
        .filter(([key, value]) => String(value) !== (beforeByKey[key] ?? ""))
        .map(([key, value]) => {
          if (isSecretKey(key)) {
            return { label: prettifyKey(key), from: beforeByKey[key] ? "(set)" : "(empty)", to: "(updated)" };
          }
          return { label: prettifyKey(key), from: beforeByKey[key] ?? "(empty)", to: String(value) };
        });

      setActivityMeta(c, {
        name: changes.length === 1 ? changes[0].label : `${changes.length} settings`,
        changes,
      });

      try {
        // expire 0, not a named profile: see lib/meta-catalog/cache.ts.
        revalidateTag("settings", { expire: 0 });
      } catch {
        /* Ignore if called outside Next request context */
      }
      // Hero, logo and banners are baked into edge-cached HTML.
      purgeCdn();

      return c.json({ success: true });
    }
  );

export default app;
