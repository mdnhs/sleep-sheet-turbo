# SP-1 Settings Engine and Store Profile: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every store-specific value comes from typed settings that the admin can edit, and credentials are encrypted at rest (brief §4, SP-1).

**Architecture:**
- `site_settings (key, value)` stays as it is. A typed registry, `lib/settings/registry.ts`, declares every key: its group, zod schema, default, `secret` flag, `public` flag and write permission. The settings PATCH validates against the registry instead of its hand-written zod object.
- Reads go through `getSetting(key)` and `getSettingsGroup(group)`. A group without credentials is cached in the Next data cache under the tags `settings` and `settings:<group>`. A group with credentials is read from the 60-second in-process snapshot, so plaintext never lands in the on-disk data cache while the encryption key is unset. All tags come from one `cacheTag()` helper.
- Credentials are sealed with AES-256-GCM under `SETTINGS_ENCRYPTION_KEY` and stored as `enc:v1:…`. Reads decrypt transparently. Without the key, writes stay plaintext and plaintext reads pass through, so the code deploys safely before the owner sets the key.
- A zod-free `StoreProfile` (`lib/settings/store-profile.ts`) is derived from the settings map that is already cached and already seeded into the storefront's React Query cache. Server code reads it through the same tag-invalidated `getPublicSettings()` call the layouts already make. Client code reads it from the seeded `["settings"]` query. That adds no request and no new client JS. Root `generateMetadata`, JSON-LD, the manifest, the OG image, robots.txt, the invoice and the footer all read the profile. `lib/seo/config.ts` keeps only defaults.
- No schema migration. One data-only migration (Task 12) backfills the two GTM keys and deletes four dead keys.

**Tech Stack:** Next.js 16.3.5 (App Router, no `cacheComponents`, so `unstable_cache` stays the caching tool), Hono 4, Drizzle + Postgres 18, zod 4, vitest 5, Node 22 `node:crypto`.

**Spec:** [`docs/brief.md`](../brief.md) §3 (principles) and §4 "SP-1: Settings engine and store profile". Milestones: [`docs/plan.md`](../plan.md), "Roadmap after SP-0".

**Scope of this file:** SP-1 only. Out of scope: theme (SP-3), shipping zones (SP-2), integrations table (SP-4), AI UI (SP-5; this plan only defines the `ai` settings group).

## Global Constraints

- **Next.js docs first.** Next.js is 16.3.5. Before writing Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`). This plan relies on these:
  - `01-app/03-api-reference/04-functions/generate-metadata.md`. Metadata from a prerendered route is included in the initial HTML. The title template (`title.template`) of a parent applies to a child's `title`. `openGraph.title` and `twitter.title` have their own, separate templates.
  - `01-app/02-guides/caching-without-cache-components.md` and `04-functions/unstable_cache.md`. `unstable_cache` tags reach the page or route-handler cache entry that used them, so `revalidateTag` refreshes it.
  - `04-functions/revalidateTag.md`. Inside Hono route handlers keep `revalidateTag(tag, { expire: 0 })`.
- **Versions.** Node 22 (`node:22-bookworm-slim`); pnpm 10.32.1.
- **Migrations.**
  1. Write the migration with `pnpm db:generate --name <name>` (or `--custom --name <name>` for data-only SQL).
  2. Check that the emitted SQL holds only the intended change. If it holds more, the snapshot has drifted; see `db/migrations/README.md`.
  3. The owner applies the SQL with `psql`.
  4. Commit the SQL together with `db/migrations/meta/*`.
  - The latest existing migration is `0034_checkout_drafts`; SP-1's only migration is `0035`.
  - Never run `pnpm db:migrate` or `pnpm db:push`.
- **Tests.** Use vitest, put `*.test.ts` beside the code, and import with the `@/` alias. Run with `pnpm test <path>`.
- **Commits.**
  - Commit directly to `main`, staging explicit paths only.
  - The owner often has uncommitted work in progress in the same tree. Never run `git add -A` or `git add .`.
  - Format: `type(scope): summary`, a short body, then the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Pushing.** A push to `main` deploys production. Do not push until the owner says so, and follow "Deployment order" below.
- **Peer session.** Another session commits to `main` in `features/web-analytics/**`. Do not edit anything under `features/web-analytics/`. `features/web-analytics/server/store.ts` keeps importing `getSetting` from `lib/settings-cache.ts`, so that module stays as a compatible facade (Task 4).
- **Performance budget.**
  - No new client JS for settings or metadata. Metadata and JSON-LD stay server-rendered and cached through the existing tag-invalidated `getPublicSettings()`. Client components read the store profile from the already-seeded `["settings"]` query, never from a new fetch.
  - Task 8 deletes a client component (`components/seo-verification.tsx`), so the client bundle shrinks.
  - `lib/settings/store-profile.ts` and `lib/settings/business-rules.ts` must stay free of zod (see the comment in `features/checkout/constants.ts`). The registry, which uses zod, is imported by client code only with `import type`.
  - Mobile Lighthouse for Home, Product and Checkout stays within 3 points of the SP-0 baseline, and CLS ≤ 0.1.

## Review Focus

The five failure modes most likely to hurt real users, each pinned by a test in the task named:

1. **Credentials become unreadable**, so bKash, Steadfast or Cloudinary silently act as if they were never configured. This happens if encryption runs before the app has the key, or if an old plaintext row stops reading. Pinned in Task 3 by "stores plaintext when no key is set, so the deploy is safe before the owner sets one" and in Task 4 by "reads a credential saved before encryption existed".
2. **Ordinary settings saves by non-admins start failing.** A MODERATOR with `settings:write` saving the Website, SEO, Store profile or Business rules page must not get a 403. Pinned in Task 5 by "lets a settings:write user save ordinary settings" and in Task 7 by "a settings:write user can save every store-profile and business-rules field".
3. **The homepage title or description changes on deploy.** `seo_default_title` and `seo_default_description` were saved by the SEO form but never read. Task 8 wires them, so a stale saved value would replace the live title. Pinned in Task 8 by "falls back to the built-in title when none is saved", plus the owner's pre-deploy psql check (Deployment order, step 2).
4. **Titles are doubled or `og:title` gets a suffix** ("X | Store | Store") after the root metadata becomes dynamic. Pinned in Task 8 by "does not template og:title or twitter:title" and in Task 9 by "puts the store name in the title exactly once".
5. **GTM stops loading** (GA4, Ads and Meta tracking lost) when the hardcoded container fallback is removed. Pinned in Task 12 by "loads nothing rather than a hardcoded container", plus the backfill in migration `0035` and the owner's check (Deployment order, step 3).

**Deferred, on purpose** (noted so a reviewer does not flag them as gaps):
- `public: false` is used only for the new `ai` group. Keys that are admin-only in spirit but served today (`pos_*`, `social_manager_url`) keep today's exposure; tightening them needs an authenticated dashboard read (SP-7).
- `store_timezone` is read by the invoice. The report bucketing in `features/order/server/status-buckets.ts` keeps its fixed Asia/Dhaka logic until SP-2's report work.
- The Meta/Google feed brand fallback uses `STORE_DEFAULTS.name`. Making it follow an admin edit belongs with the SP-4 integrations work.
- Orphaned credential-shaped rows (`fraud_*`) are neither encrypted nor served. Deleting them is an owner decision.
- Key rotation: the `v1` prefix leaves room for a `v2`; there is no rotation tool yet.

## Deployment order

No task changes the table structure. Four steps need the owner.

1. **Tasks 1–7** can be pushed together or one at a time. They need no database step. After Task 5 is live, every credential save goes through the registry, but values stay plaintext until step 4.
2. **Before the push that contains Task 8**, the owner runs this check:
   ```sql
   SELECT key, value FROM site_settings
   WHERE key IN ('seo_default_title','seo_default_description','seo_default_image','seo_twitter_handle',
                 'seo_google_verification','seo_bing_verification','seo_robots_ai_block');
   ```
   For each row, decide whether it should go live. Task 8 starts using all of them. Correct a stale title or description in the admin SEO page, or delete the row to fall back to the built-in default:
   ```sql
   DELETE FROM site_settings WHERE key = 'seo_default_title';
   ```
3. **Before the push that contains Task 12:**
   - Apply `db/migrations/0035_settings_white_label.sql`. It backfills `gtm_web_id` and `gtm_server_url` if they are missing or empty, and deletes the four dead keys. Then check:
     ```sql
     SELECT key, value FROM site_settings WHERE key IN ('gtm_web_id','gtm_server_url');
     ```
     Expected: `GTM-PQ667JWQ` and `https://ss.sleepsheetbd.com`, or the values you saved yourself.
   - Confirm `N8N_PRODUCT_CACHE_WEBHOOK_URL` is set in the Dokploy environment. Without it, "Sync to n8n Product Cache" now returns 503 instead of posting to a hardcoded URL.
   - Confirm `GA4_PROPERTY_ID` is set wherever the local `mcp-server` runs (the Claude MCP config).
4. **Encryption at rest.** Do this at any time after Task 5 is live, at a quiet hour.
   1. Generate the key with `openssl rand -base64 32`. Store it in the password manager first. Losing it means re-entering every credential.
   2. Set `SETTINGS_ENCRYPTION_KEY` in Dokploy and redeploy.
   3. Check that the app boots, that the admin credential pages still show values, and that a bKash sandbox payment or a Steadfast status lookup still works.
   4. From a checkout of this repo, with `DATABASE_URL` pointing at production (SSH tunnel) and the same `SETTINGS_ENCRYPTION_KEY`:
      - Dry run: `pnpm exec tsx scripts/encrypt-settings.ts`
      - Apply: `pnpm exec tsx scripts/encrypt-settings.ts --apply`
   5. Check with psql:
      ```sql
      SELECT key, left(value, 7) FROM site_settings
      WHERE key IN ('bkash_app_key','bkash_app_secret','bkash_username','bkash_password','steadfast_api_key',
                    'steadfast_secret_key','bdcourier_api_key','cloudinary_api_key','cloudinary_api_secret',
                    'google_sheets_client_email','google_sheets_private_key','google_sheets_spreadsheet_id')
        AND value <> '';
      ```
      Expected: every row shows `enc:v1:`.
   - No task runs the script against production.
5. **Task 14 is OWNER-GATED.** Deploy it only when the owner says so, at a low-traffic hour. The old cookie is still accepted and silently re-issued under the new name, so nobody should be logged out. Seven days later (the JWT lifetime), a follow-up commit deletes `LEGACY_AUTH_COOKIE`.
6. **After the last deploy**, run the mobile Lighthouse comparison (Home, Product, Checkout) against `brief.md` §2.

---

## SP-1 Tasks

### Task 1: One `cacheTag()` helper for every cache tag

**Files:**
- Create: `lib/cache-tag.ts`
- Create: `lib/cache-tag.test.ts`
- Modify: `lib/prefetch-home.ts` (every `tags: [...]`)
- Modify: `features/product/server/get-product.ts:166,176`
- Modify: `app/(client)/blog/[slug]/page.tsx:45`
- Modify: `lib/meta-catalog/cache.ts:51-52`
- Modify: `lib/content-cache.ts:24-30,49-64`
- Modify: `lib/seo/sitemap-page-data.ts:72`
- Modify: `features/settings/server/route.ts:49,253`
- Modify: `lib/startup-revalidate.ts:29`

**Interfaces:**
- Consumes: nothing.
- Produces: `type CacheTagRoot = "settings" | "products" | "categories" | "blog" | "testimonials"` and `cacheTag(root: CacheTagRoot, ...scope: string[]): string`, both from `lib/cache-tag.ts`.

- [ ] **Step 1: Write the failing test**

Create `lib/cache-tag.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cacheTag } from "@/lib/cache-tag";

describe("cacheTag", () => {
  it("returns the bare root tag", () => {
    expect(cacheTag("settings")).toBe("settings");
  });

  it("scopes a tag with a colon", () => {
    expect(cacheTag("settings", "store")).toBe("settings:store");
  });

  it("keeps the tags that existing cache entries already carry", () => {
    expect(
      (["settings", "products", "categories", "blog", "testimonials"] as const).map((root) => cacheTag(root)),
    ).toEqual(["settings", "products", "categories", "blog", "testimonials"]);
  });
});

// SaaS-ready rule 4: tags come from cacheTag() only. features/web-analytics is
// owned by a parallel session and skipped here on purpose.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path.includes("node_modules") || path.startsWith(join("features", "web-analytics"))) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("cache tag literals", () => {
  it("are spelled only in lib/cache-tag.ts", () => {
    const offenders = ["app", "features", "lib"]
      .flatMap(sourceFiles)
      .filter((file) => /tags:\s*\[\s*["'`]|revalidateTag\(\s*["'`]/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/cache-tag.test.ts`
Expected: FAIL. The import of `@/lib/cache-tag` cannot be resolved.

- [ ] **Step 3: Implement `lib/cache-tag.ts`**

```ts
/**
 * The one place a Next.js cache tag is spelled (brief §3, SaaS-ready rule 4).
 * When several stores share one database, the store prefix goes in here and
 * every unstable_cache read and revalidateTag call picks it up.
 */
export type CacheTagRoot = "settings" | "products" | "categories" | "blog" | "testimonials";

export function cacheTag(root: CacheTagRoot, ...scope: string[]): string {
  return [root, ...scope].join(":");
}
```

Run: `pnpm test lib/cache-tag.test.ts`
Expected: the three `cacheTag` tests PASS. "are spelled only in lib/cache-tag.ts" still FAILS and lists the files below.

- [ ] **Step 4: Route every tag through `cacheTag()`**

In each file, add `import { cacheTag } from "@/lib/cache-tag";` next to the other imports, then make these replacements:

| File | Before | After |
|---|---|---|
| `lib/prefetch-home.ts` (10 places) | `tags: ["settings"]`, `tags: ["categories"]`, `tags: ["products"]`, `tags: ["blog"]`, `tags: ["testimonials"]` | `tags: [cacheTag("settings")]`, `tags: [cacheTag("categories")]`, … one for one |
| `features/product/server/get-product.ts:166,176` | `tags: ["products"]` | `tags: [cacheTag("products")]` |
| `app/(client)/blog/[slug]/page.tsx:45` | `tags: ["blog"]` | `tags: [cacheTag("blog")]` |
| `lib/seo/sitemap-page-data.ts:72` | `tags: ["products", "categories", "blog"]` | `tags: [cacheTag("products"), cacheTag("categories"), cacheTag("blog")]` |
| `lib/meta-catalog/cache.ts:51-52` | `revalidateTag("products", { expire: 0 });` / `revalidateTag("categories", { expire: 0 });` | `revalidateTag(cacheTag("products"), { expire: 0 });` / `revalidateTag(cacheTag("categories"), { expire: 0 });` |
| `features/settings/server/route.ts:49` | `tags: ["settings"]` | `tags: [cacheTag("settings")]` |
| `features/settings/server/route.ts:253` | `revalidateTag("settings", { expire: 0 });` | `revalidateTag(cacheTag("settings"), { expire: 0 });` |

In `lib/content-cache.ts`, change the private helper and its two callers:

```ts
import { cacheTag, type CacheTagRoot } from "@/lib/cache-tag";

function invalidate(root: CacheTagRoot): void {
  try {
    revalidateTag(cacheTag(root), { expire: 0 });
  } catch {
    /* Ignore if invoked outside the Next.js request lifecycle */
  }
  purgeCdn();
}
```

`invalidateBlog()` keeps calling `invalidate("blog")` and `invalidateTestimonials()` keeps calling `invalidate("testimonials")`. Those are now typed roots, not tag strings.

In `lib/startup-revalidate.ts`, add the import and replace line 29 with:

```ts
// Every tag the storefront's unstable_cache reads use.
export const DATA_CACHE_TAGS = (["settings", "categories", "products", "blog", "testimonials"] as const).map(
  (root) => cacheTag(root),
);
```

- [ ] **Step 5: Verify**

Run: `pnpm test lib/cache-tag.test.ts && pnpm typecheck`
Expected: PASS (4 tests) and no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/cache-tag.ts lib/cache-tag.test.ts lib/prefetch-home.ts features/product/server/get-product.ts "app/(client)/blog/[slug]/page.tsx" lib/meta-catalog/cache.ts lib/content-cache.ts lib/seo/sitemap-page-data.ts features/settings/server/route.ts lib/startup-revalidate.ts
git commit -F - <<'EOF'
refactor(cache): build every cache tag with cacheTag()

SaaS-ready rule 4: tags were string literals in a dozen files. They now
come from one helper, so a store prefix can be added in one place later.
A test fails if a literal tag comes back. Tag values are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Settings registry and store defaults

**Files:**
- Create: `lib/settings/defaults.ts`
- Create: `lib/settings/registry.ts`
- Create: `lib/settings/registry.test.ts`

**Interfaces:**
- Consumes: `isValidSocialManagerUrl` from `lib/social-manager.ts`; `SHIPPING_ZONES` from `features/checkout/constants.ts`.
- Produces from `lib/settings/defaults.ts`: `DEFAULT_SITE_URL`, `STORE_DEFAULTS`, `SEO_DEFAULTS`, `BUSINESS_DEFAULTS`.
- Produces from `lib/settings/registry.ts`:
  - `SETTING_GROUPS`
  - `type SettingGroup`
  - `type WritePermission = "settings:write" | "admin"`
  - `type SettingDef<G, S, Secret>`
  - `SETTINGS`
  - `type SettingKey`
  - `type SettingValue<K>`
  - `type GroupValues<G>`
  - `type SettingsPatch`
  - `type SecretSettingKey`
  - `SETTING_KEYS: SettingKey[]`
  - `isSettingKey(key: string): key is SettingKey`
  - `keysInGroup(group: SettingGroup): SettingKey[]`
  - `groupHasSecrets(group: SettingGroup): boolean`
  - `serializeSetting(value: unknown): string`

- [ ] **Step 1: Write the failing test**

Create `lib/settings/registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  SETTINGS,
  SETTING_KEYS,
  groupHasSecrets,
  isSettingKey,
  keysInGroup,
  serializeSetting,
} from "@/lib/settings/registry";

// Every key the hand-written PATCH validator accepted before SP-1.
const LEGACY_KEYS = [
  "shipping_inside_dhaka", "shipping_outside_dhaka", "currency", "payment_method_card", "payment_method_cod",
  "payment_method_due", "payment_method_bkash", "social_manager_url", "bkash_mode", "bkash_app_key",
  "bkash_app_secret", "bkash_username", "bkash_password", "pos_payment_methods", "pos_facebook_pages",
  "pos_default_facebook_page", "seo_site_name", "seo_default_title", "seo_default_description",
  "seo_default_image", "seo_google_verification", "seo_bing_verification", "google_analytics_id",
  "ga4_property_id", "gtm_web_id", "gtm_server_id", "gtm_server_url", "analytics_enabled", "seo_twitter_handle",
  "seo_robots_ai_block", "cloudinary_cloud_name", "cloudinary_api_key", "cloudinary_api_secret",
  "steadfast_api_key", "steadfast_secret_key", "bdcourier_api_key", "google_sheets_client_email",
  "google_sheets_private_key", "google_sheets_spreadsheet_id", "site_name", "logo_url", "hero_title",
  "hero_subtitle", "hero_cta_text", "hero_cta_link", "hero_bg_image", "hero_slides", "promo_banners",
  "feature_1_title", "feature_1_desc", "feature_2_title", "feature_2_desc", "feature_3_title", "feature_3_desc",
  "feature_4_title", "feature_4_desc", "newsletter_title", "newsletter_subtitle", "footer_brand_desc",
  "footer_email", "footer_phone", "footer_address", "footer_address_link", "social_facebook",
  "social_instagram", "social_twitter", "social_youtube", "social_tiktok", "footer_copyright",
];

const CREDENTIALS = [
  "steadfast_api_key", "steadfast_secret_key", "bdcourier_api_key", "cloudinary_api_key", "cloudinary_api_secret",
  "google_sheets_client_email", "google_sheets_private_key", "google_sheets_spreadsheet_id", "bkash_app_key",
  "bkash_app_secret", "bkash_username", "bkash_password", "ai_api_key",
];

describe("settings registry", () => {
  it("accepts every key the settings forms sent before SP-1", () => {
    expect(LEGACY_KEYS.filter((key) => !isSettingKey(key))).toEqual([]);
  });

  it("rejects keys it does not declare", () => {
    expect(isSettingKey("seo_magic")).toBe(false);
    expect(isSettingKey("fraud_pathao_user")).toBe(false);
  });

  it("gives every key a default that passes its own schema", () => {
    for (const key of SETTING_KEYS) {
      const def = SETTINGS[key];
      const parsed = (def.schema as z.ZodType).safeParse(serializeSetting(def.default));
      expect(parsed.success, key).toBe(true);
      expect(parsed.data, key).toEqual(def.default);
    }
  });

  it("marks exactly the credentials as secret", () => {
    expect(SETTING_KEYS.filter((key) => SETTINGS[key].secret).sort()).toEqual([...CREDENTIALS].sort());
  });

  it("keeps secrets admin-only and out of the public map", () => {
    for (const key of CREDENTIALS) {
      expect(SETTINGS[key as keyof typeof SETTINGS].write, key).toBe("admin");
      expect(SETTINGS[key as keyof typeof SETTINGS].public, key).toBe(false);
    }
  });

  it("keeps the whole ai group admin-only and private", () => {
    for (const key of keysInGroup("ai")) {
      expect(SETTINGS[key].write, key).toBe("admin");
      expect(SETTINGS[key].public, key).toBe(false);
    }
  });

  it("lets settings:write change the store profile and business rules", () => {
    for (const key of [...keysInGroup("store"), ...keysInGroup("business")]) {
      expect(SETTINGS[key].write, key).toBe("settings:write");
    }
  });

  it("validates business rules", () => {
    expect(SETTINGS.order_number_prefix.schema.safeParse("ord-1").success).toBe(false);
    expect(SETTINGS.order_number_prefix.schema.safeParse("WEB").success).toBe(true);
    expect(SETTINGS.low_stock_threshold.schema.safeParse("-1").success).toBe(false);
    expect(SETTINGS.invoice_language.schema.safeParse("fr").success).toBe(false);
  });

  it("rejects an unknown time zone", () => {
    expect(SETTINGS.store_timezone.schema.safeParse("Mars/Olympus").success).toBe(false);
    expect(SETTINGS.store_timezone.schema.safeParse("Asia/Dhaka").success).toBe(true);
  });

  it("reads flags and numbers into typed values", () => {
    expect(SETTINGS.payment_method_cod.schema.parse("false")).toBe(false);
    expect(SETTINGS.shipping_inside_dhaka.schema.parse("80")).toBe(80);
  });

  it("knows which groups hold credentials", () => {
    expect(groupHasSecrets("store")).toBe(false);
    expect(groupHasSecrets("payments")).toBe(true);
    expect(groupHasSecrets("integrations")).toBe(true);
    expect(keysInGroup("store")).toEqual(expect.arrayContaining(["site_name", "store_timezone", "footer_phone"]));
  });

  it("serializes typed values back to stored strings", () => {
    expect(serializeSetting(true)).toBe("true");
    expect(serializeSetting(150)).toBe("150");
    expect(serializeSetting("x")).toBe("x");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/settings/registry.test.ts`
Expected: FAIL. The import of `@/lib/settings/registry` cannot be resolved.

- [ ] **Step 3: Create `lib/settings/defaults.ts`**

```ts
/**
 * Store values used when a setting has never been saved.
 *
 * This is the only app module allowed to name the store (brief §4, SP-1
 * acceptance: `grep -rn "Sleep Sheet"` matches only this file and tests).
 * Everything else reads the settings registry (lib/settings/registry.ts) or
 * the store profile (lib/settings/store-profile.ts), which fall back to these.
 * Kept free of zod and of server imports: client bundles read it.
 */

// Must be the host the site is actually served from (apex, not www), or
// every canonical, sitemap URL and og:url points at a redirect.
export const DEFAULT_SITE_URL = "https://sleepsheetbd.com";

export const STORE_DEFAULTS = {
  name: "Sleep Sheet",
  nameBn: "স্লিপ শীট",
  legalName: "Sleep Sheet",
  logoUrl: "/logo.webp",
  phone: "+8801570241052",
  email: "sleepsheet2025@gmail.com",
  address: "Hope Market, Mirpur 10",
  addressLink: "",
  city: "Dhaka",
  postalCode: "1216",
  dbid: "",
  tradeLicence: "",
  bin: "",
  locale: "bn_BD",
  timezone: "Asia/Dhaka",
  description: "Premium bedding and comforter sets in Bangladesh, with cash on delivery nationwide.",
  foundingYear: "2024",
  social: {
    facebook: "https://www.facebook.com/sleepsheet2025",
    instagram: "https://www.instagram.com/sleepsheet2025",
    twitter: "",
    youtube: "",
    tiktok: "",
  },
} as const;

export const SEO_DEFAULTS = {
  // Brand + shop intent only; the "… Price in Bangladesh" phrases belong to
  // the category pages, or our own pages compete for the same query.
  title: "Sleep Sheet — Comforter & Bed Sheet Online Shop in Bangladesh",
  description:
    "১০০% টুইল কটন কম্ফোর্টার সেট ও কিং সাইজ বেডশিট অনলাইনে কিনুন। ক্যাশ অন ডেলিভারি, সারা বাংলাদেশে হোম ডেলিভারি আর ৭ দিনের রিপ্লেসমেন্ট গ্যারান্টি।",
  // 1200×630 share card rendered by app/og-image.png/route.tsx.
  image: "/og-image.png",
  themeColor: "#0f172a",
  keywords: [
    "কম্ফোর্টার সেট প্রাইজ ইন বাংলাদেশ",
    "বিছানার চাদর অনলাইন শপ",
    "কিং সাইজ বেডশিট দাম",
    "ওয়াটারপ্রুফ স্লিপ শিট",
    "কটন বেডশীট কালেকশন",
    "টুইল কটন বিছানার চাদর",
    "শীতের কম্ফোর্টার দাম",
    "বেবি স্লিপ শিট",
    "ম্যাট্রেস প্রোটেক্টর বাংলাদেশ",
    "হোটেল কোয়ালিটি বেডশীট",
    "বালিশের কভার ও কোলবালিশ কভার",
    "হোম ডেলিভারি ক্যাশ অন ডেলিভারি",
    "স্লিপ শিট বাংলাদেশ",
    "comforter price in Bangladesh",
    "bed sheet price in Bangladesh",
    "comforter set price in Bangladesh",
    "king size bed sheet price in Bangladesh",
    "waterproof sleep sheet Bangladesh",
    "bed sheet online shop Bangladesh",
    "twill cotton comforter 5 pcs set",
    "mattress protector price in Bangladesh",
    "pillow cover",
    "cash on delivery bedding",
    "online shopping Bangladesh",
    "bedding",
    "sleep accessories",
  ],
} as const;

export const BUSINESS_DEFAULTS = {
  orderNumberPrefix: "ORD",
  posOrderNumberPrefix: "POS",
  lowStockThreshold: 10,
  invoiceLanguage: "bn",
  // The dashboard product list opened on this category before it was a setting.
  defaultProductCategory: "Comforters",
} as const;
```

- [ ] **Step 4: Create `lib/settings/registry.ts`**

```ts
import { z } from "zod";
import { SHIPPING_ZONES } from "@/features/checkout/constants";
import { isValidSocialManagerUrl } from "@/lib/social-manager";
import { BUSINESS_DEFAULTS, SEO_DEFAULTS, STORE_DEFAULTS } from "@/lib/settings/defaults";

/**
 * Every key in site_settings, typed (brief §4, SP-1 "Registry").
 *
 * - group: the cache unit (tags `settings` + `settings:<group>`).
 * - schema: validates a PATCH value and parses a stored string into its
 *   typed value. Values are still stored as text.
 * - default: used when the row is missing or empty.
 * - secret: sealed at rest (lib/settings/crypto.ts), never served by the
 *   public GET (only a `<key>_set` flag), readable by ADMIN only.
 * - public: served by the unauthenticated GET /api/settings.
 * - write: "admin" keys are refused (403) for anyone below ADMIN.
 *
 * Server and admin code only: this module imports zod. Client code may use
 * `import type` from it, never a value import.
 */
export const SETTING_GROUPS = [
  "store", "seo", "tracking", "checkout", "payments", "integrations", "pos", "content", "business", "ai",
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];
export type WritePermission = "settings:write" | "admin";

export type SettingDef<
  G extends SettingGroup = SettingGroup,
  S extends z.ZodType = z.ZodType,
  Secret extends boolean = boolean,
> = {
  group: G;
  schema: S;
  default: z.output<S>;
  secret: Secret;
  public: boolean;
  write: WritePermission;
};

function plain<G extends SettingGroup, S extends z.ZodType>(
  group: G,
  schema: S,
  defaultValue: z.output<S>,
  options: { public?: boolean; write?: WritePermission } = {},
): SettingDef<G, S, false> {
  return {
    group,
    schema,
    default: defaultValue,
    secret: false,
    public: options.public ?? true,
    write: options.write ?? "settings:write",
  };
}

// Not trimmed: a pasted PEM private key keeps its exact bytes.
const secretText = z.string().max(10_000);

function secret<G extends SettingGroup>(group: G): SettingDef<G, typeof secretText, true> {
  return { group, schema: secretText, default: "", secret: true, public: false, write: "admin" };
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const text = z.string().trim().max(2_000);
// hero_slides / promo_banners / pos_* hold JSON written by the admin managers.
const longText = z.string().max(200_000);
const flag = z.enum(["true", "false"]).transform((value) => value === "true");
const amount = z.coerce.number().min(0);
const count = z.coerce.number().int().min(0).max(1_000_000);
const httpUrl = z.string().trim().refine(isValidSocialManagerUrl, "Must be an http(s) URL");
const timeZone = z.string().trim().refine(isTimeZone, "Unknown time zone");
const year = z.string().trim().regex(/^(\d{4})?$/, "A four-digit year");
const prefix = z.string().trim().regex(/^[A-Z0-9]{2,6}$/, "2–6 capital letters or digits");

const adminOnly = { public: false, write: "admin" } as const;

export const SETTINGS = {
  // ── store: the store profile (brief §4, SP-1 "Store profile store.*").
  // Pre-SP-1 keys keep their names (site_name, footer_*, social_*), so no
  // stored row moves; new fields use a store_ prefix.
  site_name: plain("store", text, STORE_DEFAULTS.name),
  store_name_bn: plain("store", text, STORE_DEFAULTS.nameBn),
  store_legal_name: plain("store", text, STORE_DEFAULTS.legalName),
  logo_url: plain("store", text, STORE_DEFAULTS.logoUrl),
  footer_phone: plain("store", text, STORE_DEFAULTS.phone),
  footer_email: plain("store", text, STORE_DEFAULTS.email),
  footer_address: plain("store", text, STORE_DEFAULTS.address),
  footer_address_link: plain("store", text, STORE_DEFAULTS.addressLink),
  store_city: plain("store", text, STORE_DEFAULTS.city),
  store_postal_code: plain("store", text, STORE_DEFAULTS.postalCode),
  store_dbid: plain("store", text, STORE_DEFAULTS.dbid),
  store_trade_licence: plain("store", text, STORE_DEFAULTS.tradeLicence),
  store_bin: plain("store", text, STORE_DEFAULTS.bin),
  store_locale: plain("store", z.enum(["bn_BD", "en_US"]), STORE_DEFAULTS.locale),
  store_timezone: plain("store", timeZone, STORE_DEFAULTS.timezone),
  store_description: plain("store", text, STORE_DEFAULTS.description),
  store_founding_year: plain("store", year, STORE_DEFAULTS.foundingYear),
  social_facebook: plain("store", text, STORE_DEFAULTS.social.facebook),
  social_instagram: plain("store", text, STORE_DEFAULTS.social.instagram),
  social_twitter: plain("store", text, STORE_DEFAULTS.social.twitter),
  social_youtube: plain("store", text, STORE_DEFAULTS.social.youtube),
  social_tiktok: plain("store", text, STORE_DEFAULTS.social.tiktok),

  // ── seo
  seo_site_name: plain("seo", text, STORE_DEFAULTS.name), // dead: removed in Task 12
  seo_default_title: plain("seo", text, SEO_DEFAULTS.title),
  seo_default_description: plain("seo", text, SEO_DEFAULTS.description),
  seo_default_image: plain("seo", text, SEO_DEFAULTS.image),
  seo_google_verification: plain("seo", text, ""),
  seo_bing_verification: plain("seo", text, ""),
  seo_twitter_handle: plain("seo", text, ""),
  seo_robots_ai_block: plain("seo", flag, true),

  // ── tracking
  google_analytics_id: plain("tracking", text, ""), // dead: removed in Task 12
  ga4_property_id: plain("tracking", text, ""), // dead: removed in Task 12
  gtm_web_id: plain("tracking", text, ""),
  gtm_server_id: plain("tracking", text, ""), // dead: removed in Task 12
  gtm_server_url: plain("tracking", httpUrl, ""),
  // First-party web analytics on/off (features/web-analytics). Missing means on.
  analytics_enabled: plain("tracking", flag, true),

  // ── checkout
  shipping_inside_dhaka: plain("checkout", amount, SHIPPING_ZONES.inside_dhaka.cost),
  shipping_outside_dhaka: plain("checkout", amount, SHIPPING_ZONES.outside_dhaka.cost),
  currency: plain("checkout", z.string().trim().min(1).max(10), "BDT"),
  payment_method_card: plain("checkout", flag, false),
  payment_method_cod: plain("checkout", flag, true),
  payment_method_due: plain("checkout", flag, false),
  payment_method_bkash: plain("checkout", flag, false),

  // ── payments
  bkash_mode: plain("payments", z.enum(["sandbox", "live"]), "sandbox"),
  bkash_app_key: secret("payments"),
  bkash_app_secret: secret("payments"),
  bkash_username: secret("payments"),
  bkash_password: secret("payments"),

  // ── integrations (cloudinary_cloud_name is public: it is in every image URL)
  cloudinary_cloud_name: plain("integrations", text, ""),
  cloudinary_api_key: secret("integrations"),
  cloudinary_api_secret: secret("integrations"),
  steadfast_api_key: secret("integrations"),
  steadfast_secret_key: secret("integrations"),
  bdcourier_api_key: secret("integrations"),
  google_sheets_client_email: secret("integrations"),
  google_sheets_private_key: secret("integrations"),
  google_sheets_spreadsheet_id: secret("integrations"),
  // http(s) only, so the admin sidebar link can never be javascript:.
  social_manager_url: plain("integrations", httpUrl, ""),

  // ── pos
  pos_payment_methods: plain("pos", longText, ""),
  pos_facebook_pages: plain("pos", longText, ""),
  pos_default_facebook_page: plain("pos", text, ""),

  // ── content (homepage and footer copy)
  hero_title: plain("content", text, ""),
  hero_subtitle: plain("content", text, ""),
  hero_cta_text: plain("content", text, ""),
  hero_cta_link: plain("content", text, ""),
  hero_bg_image: plain("content", text, ""),
  hero_slides: plain("content", longText, ""),
  promo_banners: plain("content", longText, ""),
  feature_1_title: plain("content", text, ""),
  feature_1_desc: plain("content", text, ""),
  feature_2_title: plain("content", text, ""),
  feature_2_desc: plain("content", text, ""),
  feature_3_title: plain("content", text, ""),
  feature_3_desc: plain("content", text, ""),
  feature_4_title: plain("content", text, ""),
  feature_4_desc: plain("content", text, ""),
  newsletter_title: plain("content", text, ""),
  newsletter_subtitle: plain("content", text, ""),
  footer_brand_desc: plain("content", text, ""),
  footer_copyright: plain("content", text, ""),

  // ── business rules
  order_number_prefix: plain("business", prefix, BUSINESS_DEFAULTS.orderNumberPrefix),
  pos_order_number_prefix: plain("business", prefix, BUSINESS_DEFAULTS.posOrderNumberPrefix),
  low_stock_threshold: plain("business", count, BUSINESS_DEFAULTS.lowStockThreshold),
  invoice_language: plain("business", z.enum(["bn", "en"]), BUSINESS_DEFAULTS.invoiceLanguage),
  default_product_category: plain("business", text, BUSINESS_DEFAULTS.defaultProductCategory),

  // ── ai: defined here, UI ships with SP-5a or SP-5b (brief §4, SP-1 "ai group").
  ai_provider: plain("ai", z.enum(["", "openai", "anthropic", "google"]), "", adminOnly),
  ai_api_key: secret("ai"),
  ai_model_copilot: plain("ai", text, "", adminOnly),
  ai_model_content: plain("ai", text, "", adminOnly),
  ai_model_chat: plain("ai", text, "", adminOnly),
  // 0 = AI switched off: nothing is spent until the owner sets a budget.
  ai_monthly_budget_usd: plain("ai", amount, 0, adminOnly),
  ai_daily_reply_cap: plain("ai", count, 0, adminOnly),
} satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.output<(typeof SETTINGS)[K]["schema"]>;
export type GroupValues<G extends SettingGroup> = {
  [K in SettingKey as (typeof SETTINGS)[K]["group"] extends G ? K : never]: SettingValue<K>;
};
/** What a client may send to PATCH /api/settings. */
export type SettingsPatch = { [K in SettingKey]?: z.input<(typeof SETTINGS)[K]["schema"]> };
export type SecretSettingKey = {
  [K in SettingKey]: (typeof SETTINGS)[K]["secret"] extends true ? K : never;
}[SettingKey];

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTINGS, key);
}

export function keysInGroup(group: SettingGroup): SettingKey[] {
  return SETTING_KEYS.filter((key) => SETTINGS[key].group === group);
}

export function groupHasSecrets(group: SettingGroup): boolean {
  return keysInGroup(group).some((key) => SETTINGS[key].secret);
}

/** Typed value → the text stored in site_settings.value. */
export function serializeSetting(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test lib/settings/registry.test.ts && pnpm typecheck`
Expected: PASS (12 tests) and no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/settings/defaults.ts lib/settings/registry.ts lib/settings/registry.test.ts
git commit -F - <<'EOF'
feat(settings): add a typed settings registry and store defaults

Every site_settings key now has a group, zod schema, default, secret and
public flags, and a write permission. Store values that were scattered
through the code live in lib/settings/defaults.ts. Nothing reads the
registry yet.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Encrypt credentials at rest (crypto, env, backfill script)

**Files:**
- Create: `lib/settings/crypto.ts`
- Create: `lib/settings/crypto.test.ts`
- Create: `lib/settings/encrypt-rows.ts`
- Create: `lib/settings/encrypt-rows.test.ts`
- Create: `scripts/encrypt-settings.ts`
- Create: `lib/env-settings-key.test.ts`
- Modify: `lib/env.ts:42-57` (add `SETTINGS_ENCRYPTION_KEY`)
- Modify: `.env.example` (document the key)

**Interfaces:**
- Consumes: `SETTINGS`, `isSettingKey` (Task 2).
- Produces from `lib/settings/crypto.ts`:
  - `SECRET_PREFIX = "enc:v1:"`
  - `class SecretDecryptError`
  - `parseSettingsKey(raw: string): Buffer`
  - `isValidSettingsKey(raw: string): boolean`
  - `getSettingsKey(env?): Buffer | null`
  - `isEncrypted(value: string): boolean`
  - `encryptSecret(plain: string, key: Buffer, aad: string): string`
  - `decryptSecret(stored: string, key: Buffer | null, aad: string): string`
  - `sealSecret(plain: string, key: Buffer | null, aad: string): string`
- Produces from `lib/settings/encrypt-rows.ts`: `type StoredRow = { key: string; value: string }` and `planEncryption(rows: StoredRow[], key: Buffer): StoredRow[]`.
- The AAD is always the setting key, so a ciphertext copied onto another row fails to decrypt.

- [ ] **Step 1: Write the failing tests**

Create `lib/settings/crypto.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  SecretDecryptError,
  decryptSecret,
  encryptSecret,
  getSettingsKey,
  isEncrypted,
  parseSettingsKey,
  sealSecret,
} from "@/lib/settings/crypto";

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 9);

describe("settings crypto", () => {
  it("round-trips a value", () => {
    const sealed = encryptSecret("hunter2", KEY, "bkash_password");
    expect(sealed.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(sealed, KEY, "bkash_password")).toBe("hunter2");
  });

  it("produces a different ciphertext every time", () => {
    expect(encryptSecret("hunter2", KEY, "k")).not.toBe(encryptSecret("hunter2", KEY, "k"));
  });

  it("passes a plaintext value straight through", () => {
    expect(decryptSecret("legacy-plain", KEY, "bkash_password")).toBe("legacy-plain");
    expect(decryptSecret("legacy-plain", null, "bkash_password")).toBe("legacy-plain");
  });

  it("stores plaintext when no key is set, so the deploy is safe before the owner sets one", () => {
    expect(sealSecret("hunter2", null, "bkash_password")).toBe("hunter2");
  });

  it("leaves an empty value empty", () => {
    expect(sealSecret("", KEY, "bkash_password")).toBe("");
  });

  it("does not encrypt twice", () => {
    const sealed = encryptSecret("hunter2", KEY, "k");
    expect(sealSecret(sealed, KEY, "k")).toBe(sealed);
  });

  it("refuses a ciphertext moved to another setting", () => {
    const sealed = encryptSecret("hunter2", KEY, "bkash_password");
    expect(() => decryptSecret(sealed, KEY, "steadfast_api_key")).toThrow(SecretDecryptError);
  });

  it("refuses the wrong key", () => {
    const sealed = encryptSecret("hunter2", KEY, "k");
    expect(() => decryptSecret(sealed, OTHER_KEY, "k")).toThrow(SecretDecryptError);
  });

  it("refuses an encrypted value when the key is missing", () => {
    const sealed = encryptSecret("hunter2", KEY, "k");
    expect(() => decryptSecret(sealed, null, "k")).toThrow(/SETTINGS_ENCRYPTION_KEY/);
  });

  it("refuses a tampered value", () => {
    const sealed = encryptSecret("hunter2", KEY, "k");
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(() => decryptSecret(tampered, KEY, "k")).toThrow(SecretDecryptError);
  });

  it("recognises the stored prefix", () => {
    expect(isEncrypted("enc:v1:abc")).toBe(true);
    expect(isEncrypted("abc")).toBe(false);
  });

  it("requires a 32-byte key", () => {
    expect(() => parseSettingsKey(Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
    expect(parseSettingsKey(KEY.toString("base64")).equals(KEY)).toBe(true);
  });

  it("reads the key from the environment, or null when unset", () => {
    expect(getSettingsKey({})).toBeNull();
    expect(getSettingsKey({ SETTINGS_ENCRYPTION_KEY: "  " })).toBeNull();
    expect(getSettingsKey({ SETTINGS_ENCRYPTION_KEY: KEY.toString("base64") })?.equals(KEY)).toBe(true);
  });
});
```

Create `lib/settings/encrypt-rows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/settings/crypto";
import { planEncryption } from "@/lib/settings/encrypt-rows";

const KEY = Buffer.alloc(32, 3);

describe("planEncryption", () => {
  it("encrypts plaintext credentials and nothing else", () => {
    const already = encryptSecret("done", KEY, "steadfast_api_key");
    const plan = planEncryption(
      [
        { key: "bkash_password", value: "hunter2" },
        { key: "steadfast_api_key", value: already },
        { key: "bkash_username", value: "" },
        { key: "site_name", value: "Nimbus Linen" },
        { key: "fraud_pathao_user", value: "orphan" },
      ],
      KEY,
    );
    expect(plan.map((row) => row.key)).toEqual(["bkash_password"]);
    expect(decryptSecret(plan[0].value, KEY, "bkash_password")).toBe("hunter2");
  });

  it("is a no-op the second time", () => {
    const once = planEncryption([{ key: "bkash_password", value: "hunter2" }], KEY);
    expect(planEncryption(once, KEY)).toEqual([]);
  });
});
```

Create `lib/env-settings-key.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env";

const base = { DATABASE_URL: "postgres://u:p@localhost:5432/db", JWT_SECRET: "x".repeat(32) };

describe("SETTINGS_ENCRYPTION_KEY", () => {
  it("is optional", () => {
    expect(envSchema.safeParse(base).success).toBe(true);
  });

  it("accepts 32 random bytes in base64", () => {
    const key = Buffer.alloc(32, 5).toString("base64");
    expect(envSchema.safeParse({ ...base, SETTINGS_ENCRYPTION_KEY: key }).success).toBe(true);
  });

  it("rejects a key of the wrong length, so a bad deploy fails at boot", () => {
    const key = Buffer.alloc(16, 5).toString("base64");
    expect(envSchema.safeParse({ ...base, SETTINGS_ENCRYPTION_KEY: key }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test lib/settings/crypto.test.ts lib/settings/encrypt-rows.test.ts lib/env-settings-key.test.ts`
Expected: FAIL. The crypto and encrypt-rows imports cannot be resolved, and the env test "rejects a key of the wrong length" fails because the schema ignores the key.

- [ ] **Step 3: Implement `lib/settings/crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Credentials in site_settings are sealed with AES-256-GCM under
 * SETTINGS_ENCRYPTION_KEY and stored as `enc:v1:<iv>.<tag>.<ciphertext>`
 * (base64url). The setting key is the additional authenticated data, so a
 * ciphertext copied onto another row does not decrypt.
 *
 * Deploy-safe by design: with no key set, writes stay plaintext and
 * plaintext rows read as-is, so production keeps working until the owner
 * sets the key and runs scripts/encrypt-settings.ts. Never log a value
 * handled here — only key names.
 */
export const SECRET_PREFIX = "enc:v1:";
const KEY_BYTES = 32;
const IV_BYTES = 12;

export class SecretDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretDecryptError";
  }
}

export function parseSettingsKey(raw: string): Buffer {
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `SETTINGS_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}); generate one with: openssl rand -base64 32`,
    );
  }
  return key;
}

export function isValidSettingsKey(raw: string): boolean {
  try {
    parseSettingsKey(raw);
    return true;
  } catch {
    return false;
  }
}

let memo: { raw: string; key: Buffer } | null = null;

export function getSettingsKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  if (memo?.raw !== raw) memo = { raw, key: parseSettingsKey(raw) };
  return memo.key;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(SECRET_PREFIX);
}

export function encryptSecret(plain: string, key: Buffer, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SECRET_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${body.toString("base64url")}`;
}

export function decryptSecret(stored: string, key: Buffer | null, aad: string): string {
  if (!isEncrypted(stored)) return stored;
  if (!key) throw new SecretDecryptError("value is encrypted but SETTINGS_ENCRYPTION_KEY is not set");
  const parts = stored.slice(SECRET_PREFIX.length).split(".");
  if (parts.length !== 3) throw new SecretDecryptError("malformed encrypted value");
  const [iv, tag, body] = parts.map((part) => Buffer.from(part, "base64url"));
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    throw new SecretDecryptError("wrong key, or the value was altered");
  }
}

/** What to store for a credential: sealed when a key is set, otherwise as typed. */
export function sealSecret(plain: string, key: Buffer | null, aad: string): string {
  if (plain === "" || key === null || isEncrypted(plain)) return plain;
  return encryptSecret(plain, key, aad);
}
```

- [ ] **Step 4: Implement `lib/settings/encrypt-rows.ts`**

```ts
import { SETTINGS, isSettingKey } from "@/lib/settings/registry";
import { encryptSecret, isEncrypted } from "@/lib/settings/crypto";

export type StoredRow = { key: string; value: string };

/** The rows the one-off backfill rewrites: registered credentials still stored as plaintext. */
export function planEncryption(rows: StoredRow[], key: Buffer): StoredRow[] {
  return rows
    .filter((row) => isSettingKey(row.key) && SETTINGS[row.key].secret && row.value !== "" && !isEncrypted(row.value))
    .map((row) => ({ key: row.key, value: encryptSecret(row.value, key, row.key) }));
}
```

- [ ] **Step 5: Add the env var**

In `lib/env.ts`, add `import { isValidSettingsKey } from "@/lib/settings/crypto";` under the zod import. Add this field inside `envSchema`, after `N8N_PRODUCT_CACHE_WEBHOOK_URL`:

```ts
  // AES-256-GCM key for credentials in site_settings (lib/settings/crypto.ts).
  // Optional: without it credentials stay plaintext. Malformed fails boot,
  // rather than leaving every credential unreadable.
  SETTINGS_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine((value) => !value || !value.trim() || isValidSettingsKey(value), {
      message: "must be 32 random bytes, base64-encoded (openssl rand -base64 32)",
    }),
```

Append to `.env.example`:

```bash
# Encrypts credentials stored in site_settings (bKash, Steadfast, Cloudinary,
# Google Sheets, AI key). Generate with: openssl rand -base64 32
# Keep a copy in the password manager — losing it means re-entering every credential.
SETTINGS_ENCRYPTION_KEY=""
```

- [ ] **Step 6: Write the backfill script (do not run it against production)**

Create `scripts/encrypt-settings.ts`:

```ts
// One-off: encrypt the credential rows stored before SP-1 (brief §4, SP-1).
// Run only as described in docs/plans/sp-1-settings-engine.md, "Deployment
// order" step 4 — after the app already runs with the same key.
//   Dry run:  pnpm exec tsx scripts/encrypt-settings.ts
//   Apply:    pnpm exec tsx scripts/encrypt-settings.ts --apply
// Needs DATABASE_URL and SETTINGS_ENCRYPTION_KEY in the environment.
// Prints key names only, never values.
import "dotenv/config";
import { Pool } from "pg";
import { decryptSecret, getSettingsKey } from "../lib/settings/crypto";
import { planEncryption } from "../lib/settings/encrypt-rows";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const key = getSettingsKey();
  if (!key) throw new Error("SETTINGS_ENCRYPTION_KEY is not set; there is nothing to encrypt with.");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query<{ key: string; value: string }>("select key, value from site_settings");
    const updates = planEncryption(rows, key);
    console.log(`${updates.length} plaintext credential row(s): ${updates.map((u) => u.key).join(", ") || "none"}`);
    if (!apply) {
      console.log("Dry run. Re-run with --apply to write.");
      return;
    }
    if (updates.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const update of updates) {
        await client.query(`update site_settings set value = $1, "updatedAt" = now() where key = $2`, [
          update.value,
          update.key,
        ]);
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const check = await pool.query<{ key: string; value: string }>(
      "select key, value from site_settings where key = any($1)",
      [updates.map((u) => u.key)],
    );
    for (const row of check.rows) decryptSecret(row.value, key, row.key); // throws if a row can't be read back
    console.log(`Encrypted and verified ${check.rows.length} row(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test lib/settings/crypto.test.ts lib/settings/encrypt-rows.test.ts lib/env-settings-key.test.ts lib/env.test.ts && pnpm typecheck`
Expected: PASS (13 + 2 + 3 new tests, and the existing env tests still pass), with no type errors.

Run the script against nothing to prove it refuses without a key: `SETTINGS_ENCRYPTION_KEY= DATABASE_URL=postgres://x:x@127.0.0.1:1/x pnpm exec tsx scripts/encrypt-settings.ts`
Expected: exits 1 with `SETTINGS_ENCRYPTION_KEY is not set; there is nothing to encrypt with.`

- [ ] **Step 8: Commit**

```bash
git add lib/settings/crypto.ts lib/settings/crypto.test.ts lib/settings/encrypt-rows.ts lib/settings/encrypt-rows.test.ts scripts/encrypt-settings.ts lib/env.ts lib/env-settings-key.test.ts .env.example
git commit -F - <<'EOF'
feat(settings): AES-256-GCM sealing for stored credentials

Credentials can be stored as enc:v1:<iv>.<tag>.<ciphertext> under
SETTINGS_ENCRYPTION_KEY, with the setting key as AAD. Without the key,
writes stay plaintext and plaintext reads pass through, so this deploys
safely before the key exists. Adds the one-off backfill script; it has
not been run against production.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Typed reads with per-group cache tags

**Files:**
- Create: `lib/settings/parse.ts`
- Create: `lib/settings/parse.test.ts`
- Create: `lib/settings/read.ts`
- Create: `lib/settings/read.test.ts`
- Modify: `lib/settings-cache.ts` (whole file → compatibility facade)
- Modify: `lib/server-config.ts` (whole file)

**Interfaces:**
- Consumes: the registry (Task 2), the crypto module (Task 3), `cacheTag` (Task 1).
- Produces from `lib/settings/parse.ts`:
  - `readSettingValue<K>(key: K, stored: string | undefined, encKey: Buffer | null, log?): SettingValue<K>`
  - `parseGroup<G>(group: G, stored: Record<string, string>, encKey: Buffer | null, log?): GroupValues<G>`
  - `decryptStoredMap(stored, encKey, log?): Record<string, string>`
- Produces from `lib/settings/read.ts`:
  - `getStoredSettings(): Promise<Record<string, string>>` (raw rows, in-process, 60 s)
  - `invalidateStoredSettings(): void`
  - `getSettingsGroup<G>(group: G): Promise<GroupValues<G>>`
  - `getSetting<K>(key: K): Promise<SettingValue<K>>`
  - `getSettingsMap(): Promise<Record<string, string>>` (decrypted)
- `lib/settings-cache.ts` keeps its exact pre-SP-1 API: `getSettingsMap()`, `getSetting(key: string, fallback?: string): Promise<string | undefined>` and `invalidateSettingsCache()`. `features/web-analytics/server/store.ts` depends on it and is not edited.

- [ ] **Step 1: Write the failing tests**

Create `lib/settings/parse.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { encryptSecret } from "@/lib/settings/crypto";
import { decryptStoredMap, parseGroup, readSettingValue } from "@/lib/settings/parse";
import { STORE_DEFAULTS } from "@/lib/settings/defaults";

const KEY = Buffer.alloc(32, 4);

describe("readSettingValue", () => {
  it("falls back to the default when the row is missing or empty", () => {
    expect(readSettingValue("site_name", undefined, null)).toBe(STORE_DEFAULTS.name);
    expect(readSettingValue("site_name", "", null)).toBe(STORE_DEFAULTS.name);
  });

  it("parses typed values", () => {
    expect(readSettingValue("payment_method_cod", "false", null)).toBe(false);
    expect(readSettingValue("low_stock_threshold", "5", null)).toBe(5);
  });

  it("falls back on an invalid stored value and logs only the key", () => {
    const log = vi.fn();
    expect(readSettingValue("invoice_language", "fr", null, log)).toBe("bn");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("invoice_language"));
    expect(log.mock.calls[0][0]).not.toContain("fr");
  });

  it("decrypts a sealed credential", () => {
    const sealed = encryptSecret("hunter2", KEY, "bkash_password");
    expect(readSettingValue("bkash_password", sealed, KEY)).toBe("hunter2");
  });

  it("reads a credential saved before encryption existed", () => {
    expect(readSettingValue("bkash_password", "hunter2", KEY)).toBe("hunter2");
    expect(readSettingValue("bkash_password", "hunter2", null)).toBe("hunter2");
  });

  it("treats an unreadable credential as unset without logging its value", () => {
    const log = vi.fn();
    const sealed = encryptSecret("hunter2", KEY, "bkash_password");
    expect(readSettingValue("bkash_password", sealed, null, log)).toBe("");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("bkash_password"));
    expect(JSON.stringify(log.mock.calls)).not.toContain("hunter2");
  });
});

describe("parseGroup", () => {
  it("returns every key of the group and nothing else", () => {
    const store = parseGroup("store", { site_name: "Nimbus Linen", bkash_password: "x" }, null);
    expect(store.site_name).toBe("Nimbus Linen");
    expect(store.store_timezone).toBe(STORE_DEFAULTS.timezone);
    expect("bkash_password" in store).toBe(false);
  });
});

describe("decryptStoredMap", () => {
  it("decrypts sealed rows and blanks the ones it cannot read", () => {
    const sealed = encryptSecret("hunter2", KEY, "bkash_password");
    const log = vi.fn();
    expect(decryptStoredMap({ bkash_password: sealed, site_name: "A" }, KEY, log)).toEqual({
      bkash_password: "hunter2",
      site_name: "A",
    });
    expect(decryptStoredMap({ bkash_password: sealed }, null, log)).toEqual({ bkash_password: "" });
  });
});
```

Create `lib/settings/read.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as { key: string; value: string }[],
  cacheCalls: [] as { keyParts: string[]; tags: string[] }[],
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => Object.assign(Promise.resolve(state.rows), { where: () => Promise.resolve(state.rows) }),
    }),
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>, keyParts: string[], options: { tags: string[] }) => {
    state.cacheCalls.push({ keyParts, tags: options.tags });
    return fn;
  },
}));

import { encryptSecret } from "@/lib/settings/crypto";
import { getSetting, getSettingsGroup, getSettingsMap, invalidateStoredSettings } from "@/lib/settings/read";

const KEY = Buffer.alloc(32, 1);

beforeEach(() => {
  state.rows = [];
  state.cacheCalls = [];
  invalidateStoredSettings();
  vi.stubEnv("SETTINGS_ENCRYPTION_KEY", KEY.toString("base64"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("settings reads", () => {
  it("caches a group under the settings and settings:<group> tags", async () => {
    state.rows = [{ key: "site_name", value: "Nimbus Linen" }];
    const store = await getSettingsGroup("store");
    expect(store.site_name).toBe("Nimbus Linen");
    expect(state.cacheCalls).toEqual([{ keyParts: ["settings-group", "store"], tags: ["settings", "settings:store"] }]);
  });

  it("keeps groups with credentials out of the Next data cache", async () => {
    state.rows = [{ key: "bkash_mode", value: "live" }];
    expect((await getSettingsGroup("payments")).bkash_mode).toBe("live");
    expect(state.cacheCalls).toEqual([]);
  });

  it("decrypts a sealed credential", async () => {
    state.rows = [{ key: "bkash_password", value: encryptSecret("hunter2", KEY, "bkash_password") }];
    expect(await getSetting("bkash_password")).toBe("hunter2");
  });

  it("returns typed values", async () => {
    state.rows = [{ key: "low_stock_threshold", value: "5" }];
    expect(await getSetting("low_stock_threshold")).toBe(5);
  });

  it("serves the legacy string map decrypted", async () => {
    state.rows = [
      { key: "site_name", value: "Nimbus Linen" },
      { key: "steadfast_api_key", value: encryptSecret("sf-key", KEY, "steadfast_api_key") },
    ];
    expect(await getSettingsMap()).toEqual({ site_name: "Nimbus Linen", steadfast_api_key: "sf-key" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test lib/settings/parse.test.ts lib/settings/read.test.ts`
Expected: FAIL. The imports of `@/lib/settings/parse` and `@/lib/settings/read` cannot be resolved.

- [ ] **Step 3: Implement `lib/settings/parse.ts`**

```ts
import type { z } from "zod";
import {
  SETTINGS,
  keysInGroup,
  type GroupValues,
  type SettingGroup,
  type SettingKey,
  type SettingValue,
} from "@/lib/settings/registry";
import { SecretDecryptError, decryptSecret, isEncrypted } from "@/lib/settings/crypto";

type Log = (message: string) => void;
const defaultLog: Log = (message) => console.error(message);

const reason = (error: unknown) => (error instanceof SecretDecryptError ? error.message : "decrypt failed");

/**
 * Stored text → typed value. A missing or empty row, an unreadable
 * credential and an invalid value all fall back to the registry default.
 * Logs name the key only, never the value.
 */
export function readSettingValue<K extends SettingKey>(
  key: K,
  stored: string | undefined,
  encKey: Buffer | null,
  log: Log = defaultLog,
): SettingValue<K> {
  const def = SETTINGS[key];
  const fallback = def.default as SettingValue<K>;
  if (stored === undefined || stored === "") return fallback;

  let raw = stored;
  if (def.secret || isEncrypted(stored)) {
    try {
      raw = decryptSecret(stored, encKey, key);
    } catch (error) {
      log(`[settings] cannot read ${key}: ${reason(error)}`);
      return fallback;
    }
  }

  // Cast: calling safeParse on the union of every schema type doesn't type-check.
  const parsed = (def.schema as z.ZodType).safeParse(raw);
  if (!parsed.success) {
    log(`[settings] ${key} holds an invalid value; using the default`);
    return fallback;
  }
  return parsed.data as SettingValue<K>;
}

export function parseGroup<G extends SettingGroup>(
  group: G,
  stored: Record<string, string>,
  encKey: Buffer | null,
  log: Log = defaultLog,
): GroupValues<G> {
  const values: Record<string, unknown> = {};
  for (const key of keysInGroup(group)) values[key] = readSettingValue(key, stored[key], encKey, log);
  return values as GroupValues<G>;
}

/** Every row, decrypted, in the legacy string-map shape. An unreadable credential comes back "" ("not configured"). */
export function decryptStoredMap(
  stored: Record<string, string>,
  encKey: Buffer | null,
  log: Log = defaultLog,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (!isEncrypted(value)) {
      out[key] = value;
      continue;
    }
    try {
      out[key] = decryptSecret(value, encKey, key);
    } catch (error) {
      log(`[settings] cannot read ${key}: ${reason(error)}`);
      out[key] = "";
    }
  }
  return out;
}
```

- [ ] **Step 4: Implement `lib/settings/read.ts`**

```ts
import { unstable_cache } from "next/cache";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { buildFallback } from "@/lib/build-phase";
import { cacheTag } from "@/lib/cache-tag";
import { getSettingsKey } from "@/lib/settings/crypto";
import { decryptStoredMap, parseGroup } from "@/lib/settings/parse";
import {
  SETTINGS,
  groupHasSecrets,
  keysInGroup,
  type GroupValues,
  type SettingGroup,
  type SettingKey,
  type SettingValue,
} from "@/lib/settings/registry";

// The whole table is small and changes a few times a month; the settings
// PATCH drops this snapshot the moment it writes (same process).
const SNAPSHOT_TTL_MS = 60_000;
let snapshot: { values: Record<string, string>; expiresAt: number } | null = null;

/** Every row as stored (credentials still sealed). In-process only, never on disk. */
export async function getStoredSettings(): Promise<Record<string, string>> {
  if (snapshot && snapshot.expiresAt > Date.now()) return snapshot.values;
  const rows = await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  snapshot = { values, expiresAt: Date.now() + SNAPSHOT_TTL_MS };
  return values;
}

export function invalidateStoredSettings(): void {
  snapshot = null;
}

async function loadGroupRows(group: SettingGroup): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select({ key: siteSettings.key, value: siteSettings.value })
      .from(siteSettings)
      .where(inArray(siteSettings.key, keysInGroup(group)));
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    // Defaults during `next build` (no database there); a runtime failure
    // throws so unstable_cache never stores it (lib/build-phase.ts).
    return buildFallback<Record<string, string>>(error, {}, `settings group ${group}`);
  }
}

function isOutsideNextCache(error: unknown): boolean {
  return error instanceof Error && error.message.includes("incrementalCache missing");
}

async function cachedGroupRows(group: SettingGroup): Promise<Record<string, string>> {
  const read = unstable_cache(() => loadGroupRows(group), ["settings-group", group], {
    revalidate: 86400,
    tags: [cacheTag("settings"), cacheTag("settings", group)],
  });
  try {
    return await read();
  } catch (error) {
    // Scripts and tests run without Next's incremental cache.
    if (isOutsideNextCache(error)) return loadGroupRows(group);
    throw error;
  }
}

/**
 * One group, typed. A group without credentials is cached in the Next data
 * cache under `settings` and `settings:<group>`. A group holding
 * credentials is read from the in-process snapshot instead, because the
 * data cache persists to disk and, until SETTINGS_ENCRYPTION_KEY is set,
 * those rows are plaintext.
 */
export async function getSettingsGroup<G extends SettingGroup>(group: G): Promise<GroupValues<G>> {
  const stored = groupHasSecrets(group) ? await getStoredSettings() : await cachedGroupRows(group);
  return parseGroup(group, stored, getSettingsKey());
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const values = (await getSettingsGroup(SETTINGS[key].group)) as Record<string, unknown>;
  return values[key] as SettingValue<K>;
}

/** Every row decrypted, as the plain string map the pre-SP-1 readers expect. */
export async function getSettingsMap(): Promise<Record<string, string>> {
  return decryptStoredMap(await getStoredSettings(), getSettingsKey());
}
```

- [ ] **Step 5: Turn `lib/settings-cache.ts` into a facade**

Replace the whole file with:

```ts
// Compatibility facade over lib/settings/read.ts. Kept because
// features/web-analytics/server/store.ts (owned by a parallel session)
// imports getSetting from here. New code should use getSetting /
// getSettingsGroup from @/lib/settings/read, which are typed.
import { getSettingsMap, invalidateStoredSettings } from "@/lib/settings/read";

export { getSettingsMap };

/** One setting as stored text (decrypted), or `fallback` when it isn't set. */
export async function getSetting(key: string, fallback?: string): Promise<string | undefined> {
  const values = await getSettingsMap();
  return values[key] ?? fallback;
}

/** Drop the cached snapshot. Call after writing settings. */
export function invalidateSettingsCache(): void {
  invalidateStoredSettings();
}
```

- [ ] **Step 6: Read the integration credentials through the typed group**

Replace the whole of `lib/server-config.ts` with:

```ts
// Typed, decrypted reads of the integrations group (lib/settings/registry.ts).
// The group holds credentials, so it comes from the in-process snapshot,
// which the settings PATCH drops on every save.
import { getSettingsGroup } from "@/lib/settings/read";

export async function getCloudinaryConfig() {
  const s = await getSettingsGroup("integrations");
  return { cloudName: s.cloudinary_cloud_name, apiKey: s.cloudinary_api_key, apiSecret: s.cloudinary_api_secret };
}

export async function getSteadfastConfig() {
  const s = await getSettingsGroup("integrations");
  return { apiKey: s.steadfast_api_key, secretKey: s.steadfast_secret_key };
}

export async function getBdCourierConfig() {
  const s = await getSettingsGroup("integrations");
  return { apiKey: s.bdcourier_api_key };
}

export async function getGoogleSheetsConfig() {
  const s = await getSettingsGroup("integrations");
  return {
    clientEmail: s.google_sheets_client_email,
    privateKey: s.google_sheets_private_key,
    spreadsheetId: s.google_sheets_spreadsheet_id,
  };
}
```

`lib/bkash.ts` keeps calling `parseBkashConfig(await getSettingsMap())`. That map is now decrypted, so no change is needed there.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test lib/settings && pnpm typecheck`
Expected: every test under `lib/settings` PASSES (registry, crypto, encrypt-rows, parse 8, read 5), with no type errors.

Run: `pnpm test`
Expected: the whole suite passes, including `features/web-analytics` tests.

- [ ] **Step 8: Commit**

```bash
git add lib/settings/parse.ts lib/settings/parse.test.ts lib/settings/read.ts lib/settings/read.test.ts lib/settings-cache.ts lib/server-config.ts
git commit -F - <<'EOF'
feat(settings): typed getSetting/getSettingsGroup with group cache tags

Groups without credentials are cached under settings and
settings:<group>; groups with credentials stay in the in-process
snapshot so plaintext never reaches the on-disk data cache. Reads
decrypt transparently, and lib/settings-cache.ts becomes a facade over
the new reader.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Settings API validates against the registry and seals credentials

**Files:**
- Create: `lib/settings/write.ts`
- Create: `lib/settings/write.test.ts`
- Create: `lib/settings/public.ts`
- Create: `lib/settings/public.test.ts`
- Create: `features/settings/api/settings-error.ts`
- Create: `features/settings/api/settings-error.test.ts`
- Modify: `features/settings/server/route.ts` (whole file)
- Modify: `features/settings/secret-keys.ts:6-19` (derive the list from the registry)
- Modify: `features/settings/api/use-settings.ts:126-238`
- Modify: `features/settings/components/website-form.tsx:122`

**Interfaces:**
- Consumes: the registry, the crypto module, `getSettingsKey`, `invalidateStoredSettings`, `cacheTag`.
- Produces from `lib/settings/write.ts`:
  - `planSettingsWrite(input: Record<string, unknown>, actor: SettingsWriteActor, before: Record<string, string>, encKey: Buffer | null): SettingsWritePlan`
  - `type SettingChange = { label: string; from: string; to: string }`
  - `type SettingsWriteActor = { role?: string | null } | null | undefined`
  - `type SettingsWritePlan`
  - `prettifySettingKey(key: string): string`
- Produces from `lib/settings/public.ts`: `publicSettingsMap(rows: { key: string; value: string }[]): Record<string, string>`.
- Produces from `features/settings/api/settings-error.ts`: `settingsErrorMessage(body: unknown): string`.
- API behaviour:
  - `PATCH /api/settings` returns 400 `{ error: "Unknown settings", keys }`, 403 `{ error: "Only an admin can change these settings", keys }`, or 400 `{ error: "Invalid settings", issues }`.
  - `GET /api/settings` serves registered public keys plus `<secret>_set` flags.
  - `GET /api/settings/secrets` returns decrypted values to ADMIN.

- [ ] **Step 1: Write the failing tests**

Create `lib/settings/write.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/settings/crypto";
import { planSettingsWrite } from "@/lib/settings/write";

const KEY = Buffer.alloc(32, 2);
const ADMIN = { role: "ADMIN" };
const MODERATOR = { role: "MODERATOR" };

describe("planSettingsWrite", () => {
  it("lets a settings:write user save ordinary settings", () => {
    const plan = planSettingsWrite({ site_name: "Nimbus Linen", footer_phone: "+8801700000000" }, MODERATOR, {}, KEY);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.rows).toEqual([
        { key: "site_name", value: "Nimbus Linen" },
        { key: "footer_phone", value: "+8801700000000" },
      ]);
    }
  });

  it("refuses a credential change from a non-admin", () => {
    expect(planSettingsWrite({ site_name: "A", bkash_password: "x" }, MODERATOR, {}, KEY)).toEqual({
      ok: false,
      status: 403,
      body: { error: "Only an admin can change these settings", keys: ["bkash_password"] },
    });
  });

  it("refuses AI settings from a non-admin", () => {
    const plan = planSettingsWrite({ ai_provider: "openai" }, MODERATOR, {}, KEY);
    expect(plan.ok === false && plan.status).toBe(403);
  });

  it("rejects keys the registry does not know", () => {
    expect(planSettingsWrite({ seo_magic: "1" }, ADMIN, {}, KEY)).toEqual({
      ok: false,
      status: 400,
      body: { error: "Unknown settings", keys: ["seo_magic"] },
    });
  });

  it("rejects an invalid value and names the key", () => {
    const plan = planSettingsWrite({ order_number_prefix: "ord-1" }, ADMIN, {}, KEY);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(Object.keys(plan.body.issues ?? {})).toEqual(["order_number_prefix"]);
  });

  it("encrypts a credential when the key is set", () => {
    const plan = planSettingsWrite({ bkash_password: "hunter2" }, ADMIN, {}, KEY);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.rows[0].value.startsWith("enc:v1:")).toBe(true);
      expect(decryptSecret(plan.rows[0].value, KEY, "bkash_password")).toBe("hunter2");
    }
  });

  it("stores a credential as plaintext when no key is set", () => {
    const plan = planSettingsWrite({ bkash_password: "hunter2" }, ADMIN, {}, null);
    expect(plan.ok && plan.rows[0].value).toBe("hunter2");
  });

  it("never puts a credential value in the change log", () => {
    const plan = planSettingsWrite({ bkash_password: "hunter2" }, ADMIN, { bkash_password: "old-secret" }, KEY);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.changes).toEqual([{ label: "Bkash Password", from: "(set)", to: "(updated)" }]);
      expect(JSON.stringify(plan.changes)).not.toMatch(/hunter2|old-secret/);
    }
  });

  it("skips values that did not change, including a re-sent credential", () => {
    const before = { site_name: "A", bkash_password: encryptSecret("hunter2", KEY, "bkash_password") };
    const plan = planSettingsWrite({ site_name: "A", bkash_password: "hunter2" }, ADMIN, before, KEY);
    expect(plan.ok && plan.rows).toEqual([]);
  });

  it("writes an empty value when there was no row, so clearing a default sticks", () => {
    const plan = planSettingsWrite({ social_instagram: "" }, MODERATOR, {}, KEY);
    expect(plan.ok && plan.rows).toEqual([{ key: "social_instagram", value: "" }]);
  });

  it("stores numbers and flags as their text", () => {
    const plan = planSettingsWrite({ shipping_inside_dhaka: 80, payment_method_cod: "false" }, MODERATOR, {}, KEY);
    expect(plan.ok && plan.rows).toEqual([
      { key: "shipping_inside_dhaka", value: "80" },
      { key: "payment_method_cod", value: "false" },
    ]);
  });

  it("lists the groups that changed", () => {
    const plan = planSettingsWrite({ site_name: "A", low_stock_threshold: "5" }, MODERATOR, {}, KEY);
    expect(plan.ok && plan.groups.sort()).toEqual(["business", "store"]);
  });
});
```

Create `lib/settings/public.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { publicSettingsMap } from "@/lib/settings/public";

describe("publicSettingsMap", () => {
  const map = publicSettingsMap([
    { key: "site_name", value: "Nimbus Linen" },
    { key: "bkash_password", value: "enc:v1:a.b.c" },
    { key: "steadfast_api_key", value: "" },
    { key: "ai_provider", value: "openai" },
    { key: "fraud_pathao_user", value: "orphan" },
    { key: "seo_magic", value: "1" },
  ]);

  it("serves public values as stored", () => {
    expect(map.site_name).toBe("Nimbus Linen");
  });

  it("replaces every credential with a configured flag", () => {
    expect(map.bkash_password).toBeUndefined();
    expect(map.bkash_password_set).toBe("true");
    expect(map.steadfast_api_key_set).toBe("false");
    expect(map.ai_api_key_set).toBe("false");
  });

  it("leaves out private and unregistered rows", () => {
    expect(map.ai_provider).toBeUndefined();
    expect(map.fraud_pathao_user).toBeUndefined();
    expect(map.seo_magic).toBeUndefined();
  });
});
```

Create `features/settings/api/settings-error.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { settingsErrorMessage } from "@/features/settings/api/settings-error";

describe("settingsErrorMessage", () => {
  it("names each invalid field", () => {
    expect(
      settingsErrorMessage({ error: "Invalid settings", issues: { order_number_prefix: "2–6 capital letters or digits" } }),
    ).toBe("Invalid settings: order_number_prefix (2–6 capital letters or digits)");
  });

  it("names the refused keys", () => {
    expect(settingsErrorMessage({ error: "Only an admin can change these settings", keys: ["bkash_password"] })).toBe(
      "Only an admin can change these settings: bkash_password",
    );
  });

  it("falls back to a generic message", () => {
    expect(settingsErrorMessage(null)).toBe("Failed to save settings");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test lib/settings/write.test.ts lib/settings/public.test.ts features/settings/api/settings-error.test.ts`
Expected: FAIL. None of the three modules can be resolved.

- [ ] **Step 3: Implement `lib/settings/write.ts`**

```ts
import type { z } from "zod";
import { SETTINGS, isSettingKey, serializeSetting, type SettingGroup, type SettingKey } from "@/lib/settings/registry";
import { decryptSecret, sealSecret } from "@/lib/settings/crypto";

export type SettingChange = { label: string; from: string; to: string };
export type SettingsWriteActor = { role?: string | null } | null | undefined;
export type SettingsWritePlan =
  | { ok: true; rows: { key: SettingKey; value: string }[]; changes: SettingChange[]; groups: SettingGroup[] }
  | { ok: false; status: 400 | 403; body: { error: string; keys?: string[]; issues?: Record<string, string> } };

export const prettifySettingKey = (key: string) =>
  key
    .split("_")
    .map((word) => (word[0]?.toUpperCase() ?? "") + word.slice(1))
    .join(" ");

function previousPlain(key: SettingKey, stored: string | undefined, encKey: Buffer | null): string | undefined {
  if (stored === undefined) return undefined;
  try {
    return decryptSecret(stored, encKey, key);
  } catch {
    return undefined; // unreadable: treat as changed
  }
}

/**
 * Turns a PATCH body into rows to upsert, or a refusal. Pure, so the route's
 * rules are tested without a server. `before` is the stored (possibly
 * sealed) value of each key in the body.
 */
export function planSettingsWrite(
  input: Record<string, unknown>,
  actor: SettingsWriteActor,
  before: Record<string, string>,
  encKey: Buffer | null,
): SettingsWritePlan {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);

  const unknown = entries.map(([key]) => key).filter((key) => !isSettingKey(key));
  if (unknown.length > 0) return { ok: false, status: 400, body: { error: "Unknown settings", keys: unknown } };

  const known = entries as [SettingKey, unknown][];
  const locked = known.map(([key]) => key).filter((key) => SETTINGS[key].write === "admin");
  if (locked.length > 0 && actor?.role !== "ADMIN") {
    return { ok: false, status: 403, body: { error: "Only an admin can change these settings", keys: locked } };
  }

  const issues: Record<string, string> = {};
  const rows: { key: SettingKey; value: string }[] = [];
  const changes: SettingChange[] = [];
  const groups = new Set<SettingGroup>();

  for (const [key, raw] of known) {
    const def = SETTINGS[key];
    const parsed = (def.schema as z.ZodType).safeParse(raw);
    if (!parsed.success) {
      issues[key] = parsed.error.issues[0]?.message ?? "Invalid value";
      continue;
    }
    const plain = serializeSetting(parsed.data);
    const previous = previousPlain(key, before[key], encKey);
    if (previous !== undefined && previous === plain) continue;

    rows.push({ key, value: def.secret ? sealSecret(plain, encKey, key) : plain });
    groups.add(def.group);
    // Never log a credential: only whether one was set.
    changes.push(
      def.secret
        ? { label: prettifySettingKey(key), from: before[key] ? "(set)" : "(empty)", to: plain ? "(updated)" : "(cleared)" }
        : { label: prettifySettingKey(key), from: before[key] ?? "(empty)", to: plain },
    );
  }

  if (Object.keys(issues).length > 0) return { ok: false, status: 400, body: { error: "Invalid settings", issues } };
  return { ok: true, rows, changes, groups: [...groups] };
}
```

- [ ] **Step 4: Implement `lib/settings/public.ts`**

```ts
import { SETTINGS, SETTING_KEYS } from "@/lib/settings/registry";

/**
 * The unauthenticated settings map: every registered public key as stored,
 * plus a `<key>_set` flag per credential so the admin UI can show
 * configured state. Credentials, private keys (the ai group) and rows the
 * registry doesn't know (orphaned fraud_* logins) are never served.
 */
export function publicSettingsMap(rows: { key: string; value: string }[]): Record<string, string> {
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const map: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    const def = SETTINGS[key];
    if (def.secret) {
      map[`${key}_set`] = stored[key] ? "true" : "false";
      continue;
    }
    if (def.public && stored[key] !== undefined) map[key] = stored[key];
  }
  return map;
}
```

- [ ] **Step 5: Implement `features/settings/api/settings-error.ts`**

```ts
/** A readable toast for a refused settings save (400/403 from PATCH /api/settings). */
export function settingsErrorMessage(body: unknown): string {
  const b = body as { error?: string; keys?: string[]; issues?: Record<string, string> } | null;
  if (b?.issues && Object.keys(b.issues).length > 0) {
    const details = Object.entries(b.issues).map(([key, message]) => `${key} (${message})`).join(", ");
    return `${b.error ?? "Invalid settings"}: ${details}`;
  }
  if (b?.keys?.length) return `${b.error ?? "Failed to save settings"}: ${b.keys.join(", ")}`;
  return b?.error ?? "Failed to save settings";
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test lib/settings/write.test.ts lib/settings/public.test.ts features/settings/api/settings-error.test.ts`
Expected: PASS (12 + 3 + 3 tests).

- [ ] **Step 7: Derive the secret-key list from the registry**

In `features/settings/secret-keys.ts`, replace lines 1-19 (the comment and the `SECRET_SETTING_KEYS` array) with:

```ts
import { SETTINGS, SETTING_KEYS, type SecretSettingKey } from "@/lib/settings/registry";

// Credentials, from the registry: never served by the public GET (only a
// "<key>_set" flag), readable through the ADMIN-only /secrets endpoint,
// writable by ADMIN only.
export const SECRET_SETTING_KEYS: readonly SecretSettingKey[] = SETTING_KEYS.filter(
  (key): key is SecretSettingKey => SETTINGS[key].secret,
);
```

Keep `SECRET_KEY_PATTERN`, `isSecretKey` and `secretKeysIn` unchanged. The SP-0 test `features/settings/secret-keys.test.ts` must still pass.

- [ ] **Step 8: Rewire the route**

Replace the whole of `features/settings/server/route.ts` with:

```ts
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

    // All upserts in one transaction, so a failure saves none of them.
    if (plan.rows.length > 0) {
      await batch((tx) =>
        plan.rows.map(({ key, value }) =>
          tx
            .insert(siteSettings)
            .values({ key, value })
            .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } }),
        ),
      );
    }

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
```

- [ ] **Step 9: Type the client hooks from the registry**

In `features/settings/api/use-settings.ts`:

1. Add, under the existing imports:
   ```ts
   import type { SecretSettingKey, SettingsPatch } from "@/lib/settings/registry";
   import { settingsErrorMessage } from "@/features/settings/api/settings-error";
   ```
   It must be `import type`: this hook runs on every storefront page, and a value import would pull zod into that bundle.
2. In `useSettingsSecrets`, replace the whole `return res.json() as Promise<{ … }>;` (lines 134-147) with:
   ```ts
         return res.json() as Promise<Record<SecretSettingKey, string>>;
   ```
3. In `useUpdateSettings`, replace the inline parameter type and the body of `mutationFn` (from `mutationFn: async (data: {` through `return res.json();`) with:
   ```ts
       mutationFn: async (data: SettingsPatch) => {
         const res = await client.api.settings.$patch({ json: data });
         if (!res.ok) throw new Error(settingsErrorMessage(await res.json().catch(() => null)));
         return res.json();
       },
   ```

In `features/settings/components/website-form.tsx`, add `import type { SettingsPatch } from "@/lib/settings/registry";` and change line 122 to:

```ts
    mutate(payload as SettingsPatch);
```

- [ ] **Step 10: Verify**

Run: `pnpm typecheck`
Expected: no errors. If another settings form passes a plain `string` where `SettingsPatch` expects `"true" | "false"`, narrow it at that call site with `value ? "true" : "false"`, the pattern the payments form already uses. Do not widen `SettingsPatch`.

Run: `pnpm test lib/settings features/settings`
Expected: all PASS, including the SP-0 `secret-keys.test.ts`.

Manual check (`pnpm dev`):
- As ADMIN, save the Website page with one field changed. The save succeeds. `/dashboard/activity` shows exactly that field.
- Save the bKash form. The activity log shows `(set) → (updated)`, never a value.
- `curl -s localhost:3000/api/settings | jq 'has("bkash_password"), .bkash_password_set'` prints `false` and `"true"` (or `"false"`).

- [ ] **Step 11: Commit**

```bash
git add lib/settings/write.ts lib/settings/write.test.ts lib/settings/public.ts lib/settings/public.test.ts features/settings/api/settings-error.ts features/settings/api/settings-error.test.ts features/settings/server/route.ts features/settings/secret-keys.ts features/settings/api/use-settings.ts features/settings/components/website-form.tsx
git commit -F - <<'EOF'
feat(settings): validate saves against the registry and seal credentials

The PATCH now checks every key against lib/settings/registry.ts instead
of a hand-written zod object: unknown keys 400, admin-only keys 403
below ADMIN, invalid values 400 naming the field. Credentials are
sealed when SETTINGS_ENCRYPTION_KEY is set, unchanged values are not
rewritten, and the public GET serves registered public keys only.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: The store profile model

**Files:**
- Create: `lib/settings/store-profile.ts`
- Create: `lib/settings/store-profile.test.ts`
- Create: `lib/settings/store.ts`
- Create: `hooks/use-store-profile.ts`
- Modify: `lib/seo/config.ts` (whole file → defaults only)
- Modify: `hooks/use-website-settings.ts:3-96`
- Modify: `components/social-links.ts:8,20-22`

**Interfaces:**
- Consumes: `STORE_DEFAULTS`, `SEO_DEFAULTS`, `DEFAULT_SITE_URL` (Task 2); `getPublicSettings` from `lib/prefetch-home.ts`; `useSettings` from `features/settings/api/use-settings.ts`.
- Produces from `lib/settings/store-profile.ts` (zod-free, isomorphic):
  - `type StoreProfile`
  - `type SiteSeo`
  - `storeProfileFromSettings(s?: SettingsLike): StoreProfile`
  - `siteSeoFromSettings(s?: SettingsLike): SiteSeo`
  - `fillStore(text: string, store: Pick<StoreProfile, "name" | "nameBn">, language?: "bn" | "en"): string`
- Produces from `lib/settings/store.ts` (server): `getStoreProfile(): Promise<StoreProfile>` and `getSiteSeo(): Promise<SiteSeo>`, both React-`cache`d over the existing tag-invalidated `getPublicSettings()`.
- Produces from `hooks/use-store-profile.ts`: `useStoreProfile(): StoreProfile`, read from the seeded `["settings"]` query.
- `lib/seo/config.ts` exports `siteUrl` and keeps `seoConfig` with its old shape, now built from the defaults.

```ts
type StoreProfile = {
  name: string; nameBn: string; legalName: string; logoUrl: string; phone: string; email: string;
  address: string; addressLink: string; city: string; postalCode: string; country: "BD";
  dbid: string; tradeLicence: string; bin: string; locale: string; timezone: string;
  description: string; foundingYear: string;
  social: { facebook: string; instagram: string; twitter: string; youtube: string; tiktok: string };
  sameAs: string[];
};
type SiteSeo = {
  title: string; description: string; image: string; twitterHandle: string;
  googleVerification: string; bingVerification: string; blockAiTraining: boolean;
};
```

- [ ] **Step 1: Write the failing test**

Create `lib/settings/store-profile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SEO_DEFAULTS, STORE_DEFAULTS } from "@/lib/settings/defaults";
import { fillStore, siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";

describe("storeProfileFromSettings", () => {
  it("falls back to the defaults when settings are unavailable", () => {
    const store = storeProfileFromSettings(null);
    expect(store.name).toBe(STORE_DEFAULTS.name);
    expect(store.phone).toBe(STORE_DEFAULTS.phone);
    expect(store.sameAs).toEqual([STORE_DEFAULTS.social.facebook, STORE_DEFAULTS.social.instagram]);
  });

  it("uses saved values", () => {
    const store = storeProfileFromSettings({ site_name: "Nimbus Linen", footer_phone: "+8801700000000", store_city: "Chattogram" });
    expect(store).toMatchObject({ name: "Nimbus Linen", phone: "+8801700000000", city: "Chattogram" });
  });

  it("never shows an empty store name", () => {
    expect(storeProfileFromSettings({ site_name: "  " }).name).toBe(STORE_DEFAULTS.name);
  });

  it("drops a social link the admin cleared", () => {
    const store = storeProfileFromSettings({ social_instagram: "" });
    expect(store.social.instagram).toBe("");
    expect(store.sameAs).toEqual([STORE_DEFAULTS.social.facebook]);
  });

  it("defaults the legal name to the store name", () => {
    expect(storeProfileFromSettings({ site_name: "Nimbus Linen" }).legalName).toBe("Nimbus Linen");
  });

  it("never falls back to a placeholder brand", () => {
    expect(JSON.stringify(storeProfileFromSettings({}))).not.toMatch(/LUXSTORE|LUXESTORE/i);
  });
});

describe("siteSeoFromSettings", () => {
  it("falls back to the built-in title and description", () => {
    expect(siteSeoFromSettings(null)).toMatchObject({ title: SEO_DEFAULTS.title, description: SEO_DEFAULTS.description });
  });

  it("blocks AI training crawlers unless switched off", () => {
    expect(siteSeoFromSettings({}).blockAiTraining).toBe(true);
    expect(siteSeoFromSettings({ seo_robots_ai_block: "false" }).blockAiTraining).toBe(false);
  });
});

describe("fillStore", () => {
  const store = { name: "Nimbus Linen", nameBn: "নিম্বাস লিনেন" };

  it("fills the English name by default", () => {
    expect(fillStore("About {store}", store)).toBe("About Nimbus Linen");
  });

  it("fills the Bangla name in Bangla copy", () => {
    expect(fillStore("{store} সম্পর্কে", store, "bn")).toBe("নিম্বাস লিনেন সম্পর্কে");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/settings/store-profile.test.ts`
Expected: FAIL. The import of `@/lib/settings/store-profile` cannot be resolved.

- [ ] **Step 3: Implement `lib/settings/store-profile.ts`**

```ts
import { SEO_DEFAULTS, STORE_DEFAULTS } from "@/lib/settings/defaults";

/**
 * The store profile, derived from the public settings map. No zod, no
 * server imports: the storefront reads it on every page from the
 * ["settings"] query the (client) layout already seeds, and the server
 * reads it from the same tag-invalidated getPublicSettings().
 */
type SettingsLike = Readonly<Record<string, string | undefined>> | null | undefined;

export type StoreProfile = {
  name: string;
  nameBn: string;
  legalName: string;
  logoUrl: string;
  phone: string;
  email: string;
  address: string;
  addressLink: string;
  city: string;
  postalCode: string;
  country: "BD";
  dbid: string;
  tradeLicence: string;
  bin: string;
  locale: string;
  timezone: string;
  description: string;
  foundingYear: string;
  social: { facebook: string; instagram: string; twitter: string; youtube: string; tiktok: string };
  sameAs: string[];
};

export type SiteSeo = {
  title: string;
  description: string;
  image: string;
  twitterHandle: string;
  googleVerification: string;
  bingVerification: string;
  blockAiTraining: boolean;
};

/** A saved empty value still falls back: a store with no name or phone makes no sense. */
function required(s: SettingsLike, key: string, fallback: string): string {
  return s?.[key]?.trim() || fallback;
}

/** A saved empty value means "none"; only a never-saved one falls back. */
function optional(s: SettingsLike, key: string, fallback: string): string {
  const value = s?.[key];
  return value === undefined ? fallback : value.trim();
}

export function storeProfileFromSettings(s?: SettingsLike): StoreProfile {
  const name = required(s, "site_name", STORE_DEFAULTS.name);
  const social = {
    facebook: optional(s, "social_facebook", STORE_DEFAULTS.social.facebook),
    instagram: optional(s, "social_instagram", STORE_DEFAULTS.social.instagram),
    twitter: optional(s, "social_twitter", STORE_DEFAULTS.social.twitter),
    youtube: optional(s, "social_youtube", STORE_DEFAULTS.social.youtube),
    tiktok: optional(s, "social_tiktok", STORE_DEFAULTS.social.tiktok),
  };
  return {
    name,
    nameBn: required(s, "store_name_bn", STORE_DEFAULTS.nameBn),
    legalName: required(s, "store_legal_name", name),
    logoUrl: required(s, "logo_url", STORE_DEFAULTS.logoUrl),
    phone: required(s, "footer_phone", STORE_DEFAULTS.phone),
    email: required(s, "footer_email", STORE_DEFAULTS.email),
    address: optional(s, "footer_address", STORE_DEFAULTS.address),
    addressLink: optional(s, "footer_address_link", STORE_DEFAULTS.addressLink),
    city: required(s, "store_city", STORE_DEFAULTS.city),
    postalCode: optional(s, "store_postal_code", STORE_DEFAULTS.postalCode),
    country: "BD",
    dbid: optional(s, "store_dbid", STORE_DEFAULTS.dbid),
    tradeLicence: optional(s, "store_trade_licence", STORE_DEFAULTS.tradeLicence),
    bin: optional(s, "store_bin", STORE_DEFAULTS.bin),
    locale: required(s, "store_locale", STORE_DEFAULTS.locale),
    timezone: required(s, "store_timezone", STORE_DEFAULTS.timezone),
    description: required(s, "store_description", STORE_DEFAULTS.description),
    foundingYear: optional(s, "store_founding_year", STORE_DEFAULTS.foundingYear),
    social,
    sameAs: Object.values(social).filter(Boolean),
  };
}

export function siteSeoFromSettings(s?: SettingsLike): SiteSeo {
  return {
    title: required(s, "seo_default_title", SEO_DEFAULTS.title),
    description: required(s, "seo_default_description", SEO_DEFAULTS.description),
    image: required(s, "seo_default_image", SEO_DEFAULTS.image),
    twitterHandle: optional(s, "seo_twitter_handle", ""),
    googleVerification: optional(s, "seo_google_verification", ""),
    bingVerification: optional(s, "seo_bing_verification", ""),
    blockAiTraining: s?.seo_robots_ai_block !== "false",
  };
}

/** Puts the store name into copy written with a {store} placeholder. */
export function fillStore(
  text: string,
  store: Pick<StoreProfile, "name" | "nameBn">,
  language: "bn" | "en" = "en",
): string {
  return text.replaceAll("{store}", language === "bn" ? store.nameBn : store.name);
}
```

- [ ] **Step 4: Server and client accessors**

Create `lib/settings/store.ts`:

```ts
import { cache } from "react";
import { getPublicSettings } from "@/lib/prefetch-home";
import { siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";

// The same cached, "settings"-tagged read both layouts already make, so a
// render that asks for the profile costs no extra query, and a settings save
// refreshes every page that used it (the tag reaches the page's cache entry).
const publicSettings = cache(() => getPublicSettings().catch(() => null));

export const getStoreProfile = cache(async () => storeProfileFromSettings(await publicSettings()));
export const getSiteSeo = cache(async () => siteSeoFromSettings(await publicSettings()));
```

Create `hooks/use-store-profile.ts`:

```ts
"use client";

import { useMemo } from "react";
import { useSettings } from "@/features/settings/api/use-settings";
import { storeProfileFromSettings, type StoreProfile } from "@/lib/settings/store-profile";

/** The store profile from the ["settings"] query the (client) layout seeds: no extra request. */
export function useStoreProfile(): StoreProfile {
  const { data } = useSettings();
  return useMemo(() => storeProfileFromSettings(data), [data]);
}
```

- [ ] **Step 5: `lib/seo/config.ts` becomes defaults only**

Replace the whole file with:

```ts
// Defaults only. Render paths read the store profile instead
// (getStoreProfile / getSiteSeo on the server, useStoreProfile on the
// client); this object keeps its old shape so the remaining callers that
// need only siteUrl, themeColor or defaultImage keep compiling.
import { DEFAULT_SITE_URL, SEO_DEFAULTS, STORE_DEFAULTS } from "@/lib/settings/defaults";

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;

export const seoConfig = {
  siteName: STORE_DEFAULTS.name,
  siteUrl,
  defaultTitle: SEO_DEFAULTS.title,
  defaultDescription: SEO_DEFAULTS.description,
  defaultImage: SEO_DEFAULTS.image,
  defaultLocale: STORE_DEFAULTS.locale,
  themeColor: SEO_DEFAULTS.themeColor,
  organization: {
    name: STORE_DEFAULTS.name,
    url: siteUrl,
    logo: `${siteUrl}${STORE_DEFAULTS.logoUrl}`,
    description: STORE_DEFAULTS.description,
    foundingDate: STORE_DEFAULTS.foundingYear,
    founders: [] as string[],
    sameAs: [STORE_DEFAULTS.social.facebook, STORE_DEFAULTS.social.instagram],
  },
  address: {
    streetAddress: STORE_DEFAULTS.address,
    addressLocality: STORE_DEFAULTS.city,
    addressRegion: STORE_DEFAULTS.city,
    postalCode: STORE_DEFAULTS.postalCode,
    addressCountry: "BD",
  },
  contact: {
    telephone: STORE_DEFAULTS.phone,
    email: STORE_DEFAULTS.email,
    contactType: "customer service",
  },
  socialLinks: {
    facebook: STORE_DEFAULTS.social.facebook,
    instagram: STORE_DEFAULTS.social.instagram,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || "",
    bing: process.env.NEXT_PUBLIC_BING_VERIFICATION || "",
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || "",
  },
};
```

In `lib/seo/index.ts`, change the first line to `export { seoConfig, siteUrl } from "./config"`.

- [ ] **Step 6: Storefront settings read the profile**

In `hooks/use-website-settings.ts`:

1. Add `import { storeProfileFromSettings } from "@/lib/settings/store-profile";` under the existing imports.
2. Directly after `const { data: settings, ...rest } = useSettings();`, add `const store = storeProfileFromSettings(settings);`.
3. Replace these lines in the returned object:

| Before | After |
|---|---|
| `siteName: settings?.site_name \|\| "LUXSTORE",` | `siteName: store.name,` |
| `logoUrl: settings?.logo_url \|\| "/logo.webp",` | `logoUrl: store.logoUrl,` |
| `footerEmail: settings?.footer_email \|\| "support@sleepsheet.com",` | `footerEmail: store.email,` |
| `footerPhone: settings?.footer_phone \|\| "+8801570241052",` | `footerPhone: store.phone,` |
| `footerAddress: settings?.footer_address \|\| "",` | `footerAddress: store.address,` |
| `footerAddressLink: settings?.footer_address_link \|\| "",` | `footerAddressLink: store.addressLink,` |
| `socialFacebook: settings?.social_facebook \|\| "",` (and the four siblings) | `socialFacebook: store.social.facebook,` / `socialInstagram: store.social.instagram,` / `socialTwitter: store.social.twitter,` / `socialYoutube: store.social.youtube,` / `socialTiktok: store.social.tiktok,` |
| `` `© ${new Date().getFullYear()} SLEEP SHEET. All rights reserved.` `` | `` `© ${new Date().getFullYear()} ${store.name.toUpperCase()}. All rights reserved.` `` |

4. Add `store,` to the returned object, right after `settings,`.

In `components/social-links.ts`, delete line 8 (`import { seoConfig } from "@/lib/seo";`) and the comment on line 19. Change lines 21-22 to:

```ts
    { label: "Instagram", href: s.socialInstagram, Icon: IconBrandInstagram },
    { label: "Facebook", href: s.socialFacebook, Icon: IconBrandFacebook },
```

The profile already applies the defaults, and a link the admin cleared now stays hidden.

- [ ] **Step 7: Verify**

Run: `pnpm test lib/settings/store-profile.test.ts && pnpm typecheck`
Expected: PASS (10 tests) and no type errors.

Run: `pnpm lint hooks/use-website-settings.ts hooks/use-store-profile.ts lib/settings components/social-links.ts`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/settings/store-profile.ts lib/settings/store-profile.test.ts lib/settings/store.ts hooks/use-store-profile.ts lib/seo/config.ts lib/seo/index.ts hooks/use-website-settings.ts components/social-links.ts
git commit -F - <<'EOF'
feat(settings): derive a store profile from the cached settings

StoreProfile and SiteSeo come from the settings map the layouts already
cache and seed, so reading them adds no request and no client JS.
lib/seo/config.ts keeps only defaults, and the storefront hook drops
the LUXSTORE and support@sleepsheet.com fallbacks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Admin pages for the store profile and business rules

**Files:**
- Create: `features/settings/settings-fields.ts`
- Create: `features/settings/settings-fields.test.ts`
- Create: `features/settings/components/settings-fields-form.tsx`
- Create: `app/(dashboard)/dashboard/settings/store/page.tsx`
- Create: `app/(dashboard)/dashboard/settings/store/store-client.tsx`
- Create: `app/(dashboard)/dashboard/settings/business/page.tsx`
- Create: `app/(dashboard)/dashboard/settings/business/business-client.tsx`
- Modify: `app/(dashboard)/dashboard/settings/settings-nav.ts:1-47`

**Interfaces:**
- Consumes: `type SettingKey` and `type SettingsPatch` (type-only), `useSettings` and `useUpdateSettings`, `STORE_DEFAULTS` and `BUSINESS_DEFAULTS`.
- Produces from `features/settings/settings-fields.ts`:
  - `type SettingsField = { key: SettingKey; label: string; placeholder?: string; multiline?: boolean; options?: { value: string; label: string }[] }`
  - `type SettingsSection = { title: string; description?: string; fields: SettingsField[] }`
  - `STORE_PROFILE_SECTIONS`
  - `BUSINESS_RULE_SECTIONS`
  - `toSettingsPatch(fields: readonly SettingsField[], values: Record<string, string>): Record<string, string>`
- Produces from `features/settings/components/settings-fields-form.tsx`: `SettingsFieldsForm({ sections, submitLabel })`.
- The store name, logo, phone, email, address and social links stay on the existing Website page. The new Store profile page holds the fields that are new in SP-1, so no key is edited in two places.

- [ ] **Step 1: Write the failing test**

Create `features/settings/settings-fields.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { SETTINGS, isSettingKey } from "@/lib/settings/registry";
import { BUSINESS_RULE_SECTIONS, STORE_PROFILE_SECTIONS, toSettingsPatch } from "@/features/settings/settings-fields";

const storeFields = STORE_PROFILE_SECTIONS.flatMap((section) => section.fields);
const businessFields = BUSINESS_RULE_SECTIONS.flatMap((section) => section.fields);

describe("settings field lists", () => {
  it("only use registered keys", () => {
    expect([...storeFields, ...businessFields].filter((f) => !isSettingKey(f.key))).toEqual([]);
  });

  it("a settings:write user can save every store-profile and business-rules field", () => {
    for (const field of [...storeFields, ...businessFields]) {
      expect(SETTINGS[field.key].write, field.key).toBe("settings:write");
    }
  });

  it("put each field in its own group", () => {
    expect(storeFields.every((f) => SETTINGS[f.key].group === "store")).toBe(true);
    expect(businessFields.every((f) => SETTINGS[f.key].group === "business")).toBe(true);
  });

  it("offer only options the server accepts", () => {
    for (const field of [...storeFields, ...businessFields]) {
      for (const option of field.options ?? []) {
        expect((SETTINGS[field.key].schema as z.ZodType).safeParse(option.value).success, `${field.key}=${option.value}`).toBe(true);
      }
    }
  });
});

describe("toSettingsPatch", () => {
  it("sends every field, trimmed", () => {
    expect(
      toSettingsPatch(
        [{ key: "store_city", label: "City" }, { key: "store_bin", label: "BIN" }],
        { store_city: "  Dhaka ", store_bin: undefined as unknown as string },
      ),
    ).toEqual({ store_city: "Dhaka", store_bin: "" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test features/settings/settings-fields.test.ts`
Expected: FAIL. The import of `@/features/settings/settings-fields` cannot be resolved.

- [ ] **Step 3: Implement `features/settings/settings-fields.ts`**

```ts
import type { SettingKey } from "@/lib/settings/registry";
import { BUSINESS_DEFAULTS, STORE_DEFAULTS } from "@/lib/settings/defaults";

export type SettingsField = {
  key: SettingKey;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  options?: { value: string; label: string }[];
};

export type SettingsSection = { title: string; description?: string; fields: SettingsField[] };

// The store name, logo, phone, email, address and social links are edited
// on the Website page (they predate SP-1); these are the fields SP-1 adds.
export const STORE_PROFILE_SECTIONS: SettingsSection[] = [
  {
    title: "Identity",
    description: "Used in page titles, structured data, invoices and the share card.",
    fields: [
      { key: "store_name_bn", label: "Store name (Bangla)", placeholder: STORE_DEFAULTS.nameBn },
      { key: "store_legal_name", label: "Legal name", placeholder: "As on the trade licence" },
      { key: "store_description", label: "Short description", placeholder: STORE_DEFAULTS.description, multiline: true },
      { key: "store_founding_year", label: "Founded (year)", placeholder: STORE_DEFAULTS.foundingYear },
    ],
  },
  {
    title: "Location",
    description: "The street address is on the Website page, under Footer.",
    fields: [
      { key: "store_city", label: "City", placeholder: STORE_DEFAULTS.city },
      { key: "store_postal_code", label: "Postal code", placeholder: STORE_DEFAULTS.postalCode },
    ],
  },
  {
    title: "Registration",
    fields: [
      { key: "store_dbid", label: "DBID" },
      { key: "store_trade_licence", label: "Trade licence no." },
      { key: "store_bin", label: "BIN (VAT registration)" },
    ],
  },
  {
    title: "Locale",
    fields: [
      {
        key: "store_locale",
        label: "Language and region",
        options: [
          { value: "bn_BD", label: "Bangla (Bangladesh)" },
          { value: "en_US", label: "English" },
        ],
      },
      { key: "store_timezone", label: "Time zone", placeholder: STORE_DEFAULTS.timezone },
    ],
  },
];

export const BUSINESS_RULE_SECTIONS: SettingsSection[] = [
  {
    title: "Orders",
    description: "New order numbers look like PREFIX-DDMMYY-XXXXXX. Existing numbers never change.",
    fields: [
      { key: "order_number_prefix", label: "Website order prefix", placeholder: BUSINESS_DEFAULTS.orderNumberPrefix },
      { key: "pos_order_number_prefix", label: "POS order prefix", placeholder: BUSINESS_DEFAULTS.posOrderNumberPrefix },
      {
        key: "invoice_language",
        label: "Invoice language (dashboard prints)",
        options: [
          { value: "bn", label: "বাংলা" },
          { value: "en", label: "English" },
        ],
      },
    ],
  },
  {
    title: "Inventory",
    fields: [
      { key: "low_stock_threshold", label: "Low-stock alert at or below", placeholder: String(BUSINESS_DEFAULTS.lowStockThreshold) },
      {
        key: "default_product_category",
        label: "Products page opens on category",
        placeholder: BUSINESS_DEFAULTS.defaultProductCategory,
      },
    ],
  },
];

export function toSettingsPatch(fields: readonly SettingsField[], values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, (values[field.key] ?? "").trim()]));
}
```

Run: `pnpm test features/settings/settings-fields.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 4: The shared form**

Create `features/settings/components/settings-fields-form.tsx`:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { toSettingsPatch, type SettingsSection } from "@/features/settings/settings-fields";
import type { SettingsPatch } from "@/lib/settings/registry";

/** A settings page built from a field list. The server validates every value against the registry. */
export function SettingsFieldsForm({ sections, submitLabel }: { sections: SettingsSection[]; submitLabel: string }) {
  const { data, isLoading } = useSettings();
  const { mutate, isPending } = useUpdateSettings();
  const fields = sections.flatMap((section) => section.fields);

  const form = useForm<Record<string, string>>({
    values: Object.fromEntries(fields.map((field) => [field.key, data?.[field.key] ?? ""])),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {sections.map((section) => (
          <Skeleton key={section.title} className="h-40 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutate(toSettingsPatch(fields, values) as SettingsPatch))}
        className="space-y-6"
      >
        {sections.map((section) => (
          <div key={section.title} className="rounded-3xl bg-white dark:bg-card p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold tracking-tight">{section.title}</h2>
              {section.description && <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map((setting) => (
                <FormField
                  key={setting.key}
                  control={form.control}
                  name={setting.key}
                  render={({ field }) => (
                    <FormItem className={setting.multiline ? "md:col-span-2" : undefined}>
                      <FormLabel>{setting.label}</FormLabel>
                      <FormControl>
                        {setting.options ? (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Default" />
                            </SelectTrigger>
                            <SelectContent>
                              {setting.options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : setting.multiline ? (
                          <Textarea rows={3} placeholder={setting.placeholder} {...field} />
                        ) : (
                          <Input placeholder={setting.placeholder} {...field} />
                        )}
                      </FormControl>
                      {!setting.options && setting.placeholder && (
                        <FormDescription className="text-xs">Empty uses: {setting.placeholder}</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

- [ ] **Step 5: The two pages and their tabs**

Create `app/(dashboard)/dashboard/settings/store/page.tsx`:

```tsx
import { StoreProfileSettings } from "./store-client";

export default function StoreProfilePage() {
  return <StoreProfileSettings />;
}
```

Create `app/(dashboard)/dashboard/settings/store/store-client.tsx`:

```tsx
"use client";

import { SettingsFieldsForm } from "@/features/settings/components/settings-fields-form";
import { STORE_PROFILE_SECTIONS } from "@/features/settings/settings-fields";

export function StoreProfileSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Store Profile</h1>
        <p className="text-muted-foreground text-sm">
          Legal and registration details, location and locale. Name, logo, contact details and social links are on the
          Website page.
        </p>
      </div>
      <SettingsFieldsForm sections={STORE_PROFILE_SECTIONS} submitLabel="Save Store Profile" />
    </div>
  );
}
```

Create `app/(dashboard)/dashboard/settings/business/page.tsx`:

```tsx
import { BusinessRulesSettings } from "./business-client";

export default function BusinessRulesPage() {
  return <BusinessRulesSettings />;
}
```

Create `app/(dashboard)/dashboard/settings/business/business-client.tsx`:

```tsx
"use client";

import { SettingsFieldsForm } from "@/features/settings/components/settings-fields-form";
import { BUSINESS_RULE_SECTIONS } from "@/features/settings/settings-fields";

export function BusinessRulesSettings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business Rules</h1>
        <p className="text-muted-foreground text-sm">Order numbering, invoices and stock alerts</p>
      </div>
      <SettingsFieldsForm sections={BUSINESS_RULE_SECTIONS} submitLabel="Save Business Rules" />
    </div>
  );
}
```

In `app/(dashboard)/dashboard/settings/settings-nav.ts`, add `Building2` and `SlidersHorizontal` to the `lucide-react` import. Make the first two items of the `"store"` group:

```ts
      { title: "Store Profile", href: "/dashboard/settings/store", icon: Building2, module: "settings" },
      { title: "Business Rules", href: "/dashboard/settings/business", icon: SlidersHorizontal, module: "settings" },
```

- [ ] **Step 6: Verify**

Run: `pnpm test features/settings && pnpm typecheck && pnpm lint "app/(dashboard)/dashboard/settings" features/settings`
Expected: PASS, no type errors, no lint errors.

Manual check (`pnpm dev`, signed in as a MODERATOR whose role has `settings:write` but is not ADMIN):
- Open `/dashboard/settings/store`, set City to `Chattogram`, and save. The toast says "Settings saved".
- Open `/dashboard/settings/business`, set the website prefix to `ord-1`, and save. The toast says `Invalid settings: order_number_prefix (2–6 capital letters or digits)`.

- [ ] **Step 7: Commit**

```bash
git add features/settings/settings-fields.ts features/settings/settings-fields.test.ts features/settings/components/settings-fields-form.tsx "app/(dashboard)/dashboard/settings/store" "app/(dashboard)/dashboard/settings/business" "app/(dashboard)/dashboard/settings/settings-nav.ts"
git commit -F - <<'EOF'
feat(settings): store profile and business rules pages

Two settings pages built from field lists: legal and registration
details, city, postal code, locale and time zone; and the order prefixes,
invoice language, low-stock threshold and default product category.
Every field is writable with settings:write.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Root metadata, JSON-LD, manifest, OG image and robots read the profile

**Files:**
- Create: `lib/seo/root-metadata.ts`
- Create: `lib/seo/root-metadata.test.ts`
- Create: `lib/seo/json-ld.test.ts`
- Create: `lib/seo/robots.test.ts`
- Modify: `app/layout.tsx:10-15,53-142,151-200`
- Modify: `lib/seo/json-ld.tsx:1-55,260-308` (`organizationSchema`, `websiteSchema`, `localBusinessSchema`; remove `sameAsFromSettings`)
- Modify: `lib/seo/index.ts` (drop the `sameAsFromSettings` export)
- Modify: `lib/seo/robots.ts:47-74`
- Modify: `app/robots.txt/route.ts`
- Modify: `app/manifest.webmanifest/route.ts`
- Modify: `app/og-image.png/route.tsx`
- Modify: `app/(client)/page.tsx:9-15,41-53`
- Modify: `lib/startup-revalidate.ts:16-26`
- Delete: `components/seo-verification.tsx`

**Interfaces:**
- Consumes: `getStoreProfile`, `getSiteSeo`, `storeProfileFromSettings`, `siteSeoFromSettings` (Task 6); `siteUrl` and `SEO_DEFAULTS`.
- Produces from `lib/seo/root-metadata.ts`: `buildRootMetadata(store: StoreProfile, seo: SiteSeo, baseUrl: string, env?: { googleVerification?: string; bingVerification?: string }): Metadata`.
- Produces from `lib/seo/json-ld.tsx`:
  - `organizationSchema(store: StoreProfile)`
  - `websiteSchema(store: StoreProfile, seo: SiteSeo)`
  - `localBusinessSchema(store: StoreProfile)`
  - `absoluteUrl(pathOrUrl: string): string`
- Produces from `lib/seo/robots.ts`: `defaultRobotsTxt(blockAiTraining = true): string`.
- Wires the dead SEO keys `seo_default_title`, `seo_default_description`, `seo_default_image`, `seo_twitter_handle`, `seo_google_verification`, `seo_bing_verification` and `seo_robots_ai_block`. Verification moves from a client component into server metadata.

- [ ] **Step 1: Write the failing tests**

Create `lib/seo/root-metadata.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SEO_DEFAULTS } from "@/lib/settings/defaults";
import { siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";
import { buildRootMetadata } from "@/lib/seo/root-metadata";

const store = storeProfileFromSettings({ site_name: "Nimbus Linen" });
const URL_BASE = "https://nimbus.example";

describe("buildRootMetadata", () => {
  it("puts the store name in the title template", () => {
    const meta = buildRootMetadata(store, siteSeoFromSettings({}), URL_BASE);
    expect(meta.title).toEqual({ default: SEO_DEFAULTS.title, template: "%s | Nimbus Linen" });
    expect(meta.applicationName).toBe("Nimbus Linen");
    expect(meta.openGraph?.siteName).toBe("Nimbus Linen");
  });

  it("falls back to the built-in title when none is saved", () => {
    expect(buildRootMetadata(store, siteSeoFromSettings(null), URL_BASE).description).toBe(SEO_DEFAULTS.description);
  });

  it("uses the saved default title and description", () => {
    const meta = buildRootMetadata(
      store,
      siteSeoFromSettings({ seo_default_title: "Linen for every bed", seo_default_description: "Soft sheets." }),
      URL_BASE,
    );
    expect(meta.title).toEqual({ default: "Linen for every bed", template: "%s | Nimbus Linen" });
    expect(meta.description).toBe("Soft sheets.");
  });

  it("does not template og:title or twitter:title", () => {
    const meta = buildRootMetadata(store, siteSeoFromSettings({}), URL_BASE);
    expect(typeof meta.openGraph?.title).toBe("string");
    expect(typeof meta.twitter?.title).toBe("string");
  });

  it("renders verification tags on the server", () => {
    const meta = buildRootMetadata(
      store,
      siteSeoFromSettings({ seo_google_verification: "g-123", seo_bing_verification: "b-456" }),
      URL_BASE,
    );
    expect(meta.verification).toEqual({ google: "g-123", other: { "msvalidate.01": "b-456" } });
  });

  it("sets twitter:site only when a handle is saved", () => {
    expect(buildRootMetadata(store, siteSeoFromSettings({}), URL_BASE).twitter).not.toHaveProperty("site");
    expect(
      buildRootMetadata(store, siteSeoFromSettings({ seo_twitter_handle: "@nimbus" }), URL_BASE).twitter,
    ).toMatchObject({ site: "@nimbus" });
  });
});
```

Create `lib/seo/json-ld.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/seo/config";
import { siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";
import { localBusinessSchema, organizationSchema, websiteSchema } from "@/lib/seo/json-ld";

const store = storeProfileFromSettings({
  site_name: "Nimbus Linen",
  footer_phone: "+8801700000000",
  footer_address: "Road 2",
  store_city: "Chattogram",
  logo_url: "/brand.png",
  store_bin: "000123456-0101",
});

describe("store JSON-LD", () => {
  it("builds the Organization from the store profile", () => {
    const org = JSON.parse(organizationSchema(store));
    expect(org).toMatchObject({
      name: "Nimbus Linen",
      legalName: "Nimbus Linen",
      vatID: "000123456-0101",
      logo: `${siteUrl}/brand.png`,
      address: { streetAddress: "Road 2", addressLocality: "Chattogram", addressCountry: "BD" },
      contactPoint: { telephone: "+8801700000000" },
    });
  });

  it("keeps an absolute logo URL as it is", () => {
    const org = JSON.parse(organizationSchema({ ...store, logoUrl: "https://cdn.example/l.png" }));
    expect(org.logo).toBe("https://cdn.example/l.png");
  });

  it("names the WebSite after the store and describes it with the SEO description", () => {
    const site = JSON.parse(websiteSchema(store, siteSeoFromSettings({ seo_default_description: "Soft sheets." })));
    expect(site).toMatchObject({ name: "Nimbus Linen", description: "Soft sheets." });
  });

  it("lists the social profiles that exist", () => {
    expect(JSON.parse(localBusinessSchema(store)).sameAs).toEqual(store.sameAs);
  });
});
```

Create `lib/seo/robots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultRobotsTxt } from "@/lib/seo/robots";

describe("defaultRobotsTxt", () => {
  it("blocks AI training crawlers by default", () => {
    expect(defaultRobotsTxt()).toContain("User-agent: GPTBot");
  });

  it("allows them when the admin switches the block off", () => {
    expect(defaultRobotsTxt(false)).not.toContain("GPTBot");
    expect(defaultRobotsTxt(false)).toContain("Disallow: /dashboard/");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test lib/seo/root-metadata.test.ts lib/seo/json-ld.test.ts lib/seo/robots.test.ts`
Expected: FAIL. `@/lib/seo/root-metadata` cannot be resolved, `organizationSchema` ignores its argument, and `defaultRobotsTxt(false)` still contains GPTBot.

- [ ] **Step 3: Implement `lib/seo/root-metadata.ts`**

```ts
import type { Metadata } from "next";
import { SEO_DEFAULTS } from "@/lib/settings/defaults";
import type { SiteSeo, StoreProfile } from "@/lib/settings/store-profile";

/**
 * The root layout's metadata, from the store profile and the SEO settings.
 *
 * Only `title` gets a template. og:title and twitter:title stay plain
 * strings: child pages set their own (lib/seo/metadata.ts already appends
 * the store name), and a template there would make them "X | Store | Store".
 */
export function buildRootMetadata(
  store: StoreProfile,
  seo: SiteSeo,
  baseUrl: string,
  env: { googleVerification?: string; bingVerification?: string } = {},
): Metadata {
  const google = seo.googleVerification || env.googleVerification || "";
  const bing = seo.bingVerification || env.bingVerification || "";
  const isDefaultImage = seo.image === SEO_DEFAULTS.image;

  return {
    metadataBase: new URL(baseUrl),
    title: { default: seo.title, template: `%s | ${store.name}` },
    description: seo.description,
    keywords: [...SEO_DEFAULTS.keywords],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: store.locale,
      url: baseUrl,
      siteName: store.name,
      title: seo.title,
      description: seo.description,
      images: [isDefaultImage ? { url: seo.image, width: 1200, height: 630, alt: store.name } : { url: seo.image, alt: store.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [seo.image],
      ...(seo.twitterHandle ? { site: seo.twitterHandle } : {}),
    },
    alternates: { canonical: baseUrl },
    icons: { icon: "/favicon.ico", shortcut: "/favicon.ico", apple: "/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: store.name },
    applicationName: store.name,
    referrer: "origin-when-cross-origin",
    category: "ecommerce",
    ...(google || bing
      ? { verification: { ...(google ? { google } : {}), ...(bing ? { other: { "msvalidate.01": bing } } : {}) } }
      : {}),
    other: {
      "msapplication-TileColor": SEO_DEFAULTS.themeColor,
      "msapplication-config": "/browserconfig.xml",
    },
  };
}
```

- [ ] **Step 4: Root JSON-LD from the profile**

In `lib/seo/json-ld.tsx`:

1. Replace line 2 (`import { seoConfig } from "./config"`) with:
   ```ts
   import { seoConfig, siteUrl } from "./config"
   import type { SiteSeo, StoreProfile } from "@/lib/settings/store-profile"
   ```
2. Replace `organizationSchema` and `websiteSchema` (lines 12-55) with:

```ts
/** A site-relative path ("/logo.webp") made absolute; absolute URLs pass through. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  return `${siteUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`
}

function postalAddress(store: StoreProfile) {
  return {
    "@type": "PostalAddress",
    streetAddress: store.address,
    addressLocality: store.city,
    addressRegion: store.city,
    ...(store.postalCode ? { postalCode: store.postalCode } : {}),
    addressCountry: store.country,
  }
}

function contactPoint(store: StoreProfile) {
  return { "@type": "ContactPoint", telephone: store.phone, email: store.email, contactType: "customer service" }
}

// Emitted once, from the root layout.
export function organizationSchema(store: StoreProfile) {
  return jsonLd({
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: store.name,
    legalName: store.legalName,
    url: siteUrl,
    // Absolute: Google's logo guidelines for Organization require a full URL.
    logo: absoluteUrl(store.logoUrl),
    description: store.description,
    ...(store.foundingYear ? { foundingDate: store.foundingYear } : {}),
    ...(store.bin ? { vatID: store.bin } : {}),
    sameAs: store.sameAs,
    address: postalAddress(store),
    contactPoint: contactPoint(store),
    // No SearchAction here — it belongs on WebSite (below), not Organization.
  })
}

export function websiteSchema(store: StoreProfile, seo: SiteSeo) {
  return jsonLd({
    "@type": "WebSite",
    name: store.name,
    url: siteUrl,
    description: seo.description,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/shop?search={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  })
}
```

3. Replace `localBusinessSchema` (from `export function localBusinessSchema` through its closing `}`) with the version below. Keep the `openingHoursSpecification` block and its comment exactly as they are.

```ts
export function localBusinessSchema(store: StoreProfile) {
  return jsonLd({
    "@type": "Store",
    "@id": `${siteUrl}/#store`,
    name: store.name,
    url: siteUrl,
    logo: absoluteUrl(store.logoUrl),
    image: absoluteUrl(seoConfig.defaultImage),
    telephone: store.phone,
    description: store.description,
    address: postalAddress(store),
    contactPoint: contactPoint(store),
    sameAs: store.sameAs,
    // (keep the existing openingHoursSpecification comment and array here)
  })
}
```

4. Delete `sameAsFromSettings` and its doc comment. In `lib/seo/index.ts`, remove `sameAsFromSettings,` from the json-ld export list and add `absoluteUrl,`.

- [ ] **Step 5: Robots**

In `lib/seo/robots.ts`, replace `defaultRobotsTxt` with:

```ts
// AI *training* crawlers only, switched by the seo_robots_ai_block setting
// (default on). ChatGPT-User (fetches a page when a ChatGPT user asks about
// it) stays allowed; Google-Extended only governs Gemini training.
const AI_TRAINING_RULES = [
  "User-agent: GPTBot",
  "Disallow: /",
  "",
  "User-agent: Google-Extended",
  "Disallow: /",
  "",
  "User-agent: CCBot",
  "Disallow: /",
]

export function defaultRobotsTxt(blockAiTraining = true): string {
  return generateRobotsTxt({
    allowAll: true,
    disallowPaths: ["/api/", "/dashboard/", "/account/", "/checkout/", "/orders/", "/order-success/", "/track-order/"],
    additionalRules: blockAiTraining ? AI_TRAINING_RULES : [],
  })
}
```

Replace the body of `app/robots.txt/route.ts` with:

```ts
import { defaultRobotsTxt } from "@/lib/seo"
import { getSiteSeo } from "@/lib/settings/store"

export async function GET() {
  const { blockAiTraining } = await getSiteSeo()
  return new Response(defaultRobotsTxt(blockAiTraining), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  })
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test lib/seo`
Expected: PASS (6 + 4 + 2 tests).

- [ ] **Step 7: Wire the root layout**

In `app/layout.tsx`:

1. Replace the imports on lines 10-14 with:
   ```ts
   import { seoConfig, websiteSchema, organizationSchema, structuredDataScript } from "@/lib/seo";
   import { buildRootMetadata } from "@/lib/seo/root-metadata";
   import { getPublicSettings } from "@/lib/prefetch-home";
   import { getSiteSeo, getStoreProfile } from "@/lib/settings/store";
   import { siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";
   import GoogleAnalytics from "@/components/google-analytics";
   import ConsentDefaultScript from "@/components/consent-default-script";
   import PreconnectLinks from "@/components/preconnect";
   ```
   The `SeoVerification` import goes away.
2. Replace the whole `export const metadata: Metadata = { … };` block (lines 53-142) with:
   ```ts
   // Store name, title, description, share image and verification come from
   // settings. Same cached, "settings"-tagged read as the body below, so the
   // root stays prerendered and a settings save refreshes it.
   export async function generateMetadata(): Promise<Metadata> {
     const [store, seo] = await Promise.all([getStoreProfile(), getSiteSeo()]);
     return buildRootMetadata(store, seo, seoConfig.siteUrl, {
       googleVerification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
       bingVerification: process.env.NEXT_PUBLIC_BING_VERIFICATION,
     });
   }
   ```
3. In `RootLayout`, replace the comment and the line `const settings = await getPublicSettings().catch(() => null);` with:
   ```ts
     // Cached and tag-invalidated, so no per-request DB hit.
     const settings = await getPublicSettings().catch(() => null);
     const store = storeProfileFromSettings(settings);
     const seo = siteSeoFromSettings(settings);
   ```
4. Replace the two `structuredDataScript` lines with:
   ```tsx
           {structuredDataScript("organization", organizationSchema(store))}
           {structuredDataScript("website", websiteSchema(store, seo))}
   ```
5. Delete `<SeoVerification />`.

Delete `components/seo-verification.tsx`. Check that nothing else imports it: `grep -rn "seo-verification" app components features` is expected to print nothing.

- [ ] **Step 8: Home page, manifest, OG image, startup warm-up**

In `app/(client)/page.tsx`:

1. Replace the `@/lib/seo` import (lines 9-15) with:
   ```ts
   import { localBusinessSchema, seoConfig, structuredDataScript, webpageSchema } from "@/lib/seo";
   import { siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";
   ```
2. After `const productVideos = videosRes?.data || [];` add:
   ```ts
     const store = storeProfileFromSettings(settings);
     const seo = siteSeoFromSettings(settings);
   ```
3. Change the `webpageSchema(` arguments to `seo.title, seo.description, seoConfig.siteUrl,`.
4. Change the local-business line to `{structuredDataScript("local-business", localBusinessSchema(store))}`.
5. Change the `<h1 className="sr-only">` content to `{seo.title}`.

Replace the whole of `app/manifest.webmanifest/route.ts` with:

```ts
import { seoConfig } from "@/lib/seo"
import { getSiteSeo, getStoreProfile } from "@/lib/settings/store"

export async function GET() {
  const [store, seo] = await Promise.all([getStoreProfile(), getSiteSeo()])
  const manifest = {
    name: store.name,
    short_name: store.name,
    description: seo.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: seoConfig.themeColor,
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
```

In `app/og-image.png/route.tsx`:

1. Add the imports `import { seoConfig } from "@/lib/seo";` and `import { getStoreProfile } from "@/lib/settings/store";`.
2. Make `GET` read the profile: `export async function GET() { const store = await getStoreProfile(); const host = new URL(seoConfig.siteUrl).host;`.
3. Replace the text column (the `<div style={{ display: "flex", flexDirection: "column", marginLeft: 70, width: 640 }}>` element and everything inside it) with:

```tsx
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 70, width: 640 }}>
          <div style={{ fontSize: 76, color: "#1a1a1a", lineHeight: 1.1 }}>{store.name}</div>
          <div style={{ fontSize: 34, color: "#555", marginTop: 24, lineHeight: 1.35 }}>
            {store.description.length > 140 ? `${store.description.slice(0, 137)}…` : store.description}
          </div>
          <div style={{ fontSize: 26, color: "#B8245A", marginTop: 36 }}>{host}</div>
        </div>
```

The logo stays `public/logo.png`; the logo asset belongs to SP-3. Update the comment at the top of the file: the card is rendered at build with the default profile and re-rendered after each deploy and each settings save (it carries the `settings` tag).

In `lib/startup-revalidate.ts`, add three entries to `DATA_ROUTE_HANDLERS`, so the build-time defaults are replaced right after a deploy:

```ts
  "/robots.txt",
  "/manifest.webmanifest",
  "/og-image.png",
```

- [ ] **Step 9: Verify**

Run: `pnpm test lib/seo && pnpm typecheck && pnpm lint app/layout.tsx "app/(client)/page.tsx" app/manifest.webmanifest app/og-image.png app/robots.txt lib/seo`
Expected: PASS, no type errors, no lint errors.

Run: `pnpm build`
Expected: the build succeeds without a database. The log may contain `[build] prefetch /: database unreachable, using empty fallback`.

Manual check (`pnpm dev`):
- In the admin Website page, set Site Name to `Nimbus Linen` and save. Reload `/`. `<title>` is unchanged (the default title). `curl -s localhost:3000/about | grep -o '<title>[^<]*'` shows `About Us | Nimbus Linen`. The Organization JSON-LD in the page source has `"name":"Nimbus Linen"`. `/manifest.webmanifest` shows the new name.
- Set Site Name back.

- [ ] **Step 10: Commit**

```bash
git add lib/seo/root-metadata.ts lib/seo/root-metadata.test.ts lib/seo/json-ld.tsx lib/seo/json-ld.test.ts lib/seo/index.ts lib/seo/robots.ts lib/seo/robots.test.ts app/layout.tsx app/robots.txt/route.ts app/manifest.webmanifest/route.ts app/og-image.png/route.tsx "app/(client)/page.tsx" lib/startup-revalidate.ts components/seo-verification.tsx
git commit -F - <<'EOF'
feat(seo): root metadata, JSON-LD, manifest and share card from settings

The root layout's generateMetadata, the Organization/WebSite/Store
JSON-LD, the manifest, the OG card and robots.txt now read the store
profile and the SEO settings. That wires seo_default_title/description/
image, the twitter handle, both verification codes and the AI-crawler
switch, which were saved but never read. Verification moves into server
metadata and its client component is deleted.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Page metadata and server-rendered copy use the profile

**Files:**
- Create: `lib/seo/page-metadata.ts`
- Create: `lib/seo/metadata.test.ts`
- Modify: `lib/seo/metadata.ts` (whole file)
- Modify: `lib/seo/json-ld.tsx:179-193,120-145,206-244` (`webpageSchema`, `productSchema`, `articleSchema`)
- Modify: `lib/seo/types.ts` (`ProductSeoData.sellerName`)
- Modify: `lib/seo/index.ts`
- Modify: `lib/utils.ts:95-102` (`extractTags`)
- Modify the pages under `app/(client)/`: `about/page.tsx`, `contact/page.tsx`, `shipping-returns/page.tsx`, `privacy-policy/page.tsx`, `terms-of-service/page.tsx`, `testimonials/page.tsx`, `sale/page.tsx`, `shop/page.tsx`, `new-arrivals/page.tsx`, `bestsellers/page.tsx`, `blog/page.tsx`, `sitemap/page.tsx`, `page.tsx`, `categories/[value]/page.tsx`, `shop/[slug]/page.tsx`, `blog/[slug]/page.tsx`, `blog/[slug]/blog-post-client.tsx`, `videos/videos-content.tsx`, `videos/page.tsx`, `videos/share/[slug]/page.tsx`
- Modify: `components/home/seo-content.tsx:13-60`

**Interfaces:**
- Consumes: `getStoreProfile` and `getSiteSeo` (Task 6); `useStoreProfile` (Task 6).
- Produces from `lib/seo/metadata.ts`:
  - `type SeoStore = { name: string; locale: string; defaultImage: string }`
  - `type MetadataParams`
  - `generateMetadata(params: MetadataParams, store: SeoStore): Metadata`
  - `generateProductMetadata(product, store: SeoStore)`
  - `generateCategoryMetadata(category, store: SeoStore)`
  - `generateBlogMetadata(post, store: SeoStore)`
  - `generatePaginatedMetadata(baseTitle, baseDescription, baseUrl, page, totalPages, store: SeoStore)`
  - `stripStoreSuffix(title: string, storeName: string): string`
- Produces from `lib/seo/page-metadata.ts` (server only; not re-exported from `lib/seo/index.ts`, which client components import): `seoStore(): Promise<SeoStore>` and `pageMetadata(build: (store: StoreProfile) => MetadataParams): Promise<Metadata>`.
- Produces from `lib/seo/json-ld.tsx`:
  - `type Publisher = Pick<StoreProfile, "name" | "logoUrl">`
  - `webpageSchema(title, description, url, publisher: Publisher)`
  - `articleSchema(post, publisher: Publisher)`
  - `productSchema(product)`, which now names the seller from `product.sellerName ?? product.brand`.
- `extractTags(title, content?, brandTag?)`.

- [ ] **Step 1: Write the failing test**

Create `lib/seo/metadata.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateMetadata, generateProductMetadata, stripStoreSuffix } from "@/lib/seo/metadata";
import { webpageSchema } from "@/lib/seo/json-ld";
import { siteUrl } from "@/lib/seo/config";

const store = { name: "Nimbus Linen", locale: "bn_BD", defaultImage: "/og-image.png" };

describe("page metadata", () => {
  it("puts the store name in the title exactly once", () => {
    const meta = generateMetadata({ title: "About Us", description: "d", canonical: "/about" }, store);
    expect(meta.title).toEqual({ absolute: "About Us | Nimbus Linen" });
    expect(meta.openGraph?.title).toBe("About Us | Nimbus Linen");
    expect(meta.openGraph?.siteName).toBe("Nimbus Linen");
  });

  it("leaves verification to the root layout", () => {
    expect(generateMetadata({ title: "T", description: "d" }, store)).not.toHaveProperty("verification");
  });

  it("names the store in a product's fallback description", () => {
    const meta = generateProductMetadata({ name: "Blue Sheet", description: "", slug: "blue" }, store);
    expect(meta.description).toBe("Shop Blue Sheet at Nimbus Linen");
  });

  it("strips a store-name suffix an admin typed into an SEO title", () => {
    expect(stripStoreSuffix("Comforters | Nimbus Linen", "Nimbus Linen")).toBe("Comforters");
    expect(stripStoreSuffix("Comforters | nimbus linen bd", "Nimbus Linen")).toBe("Comforters");
    expect(stripStoreSuffix("Comforters", "Nimbus Linen")).toBe("Comforters");
  });
});

describe("webpageSchema", () => {
  it("credits the store as publisher", () => {
    const page = JSON.parse(webpageSchema("About", "d", `${siteUrl}/about`, { name: "Nimbus Linen", logoUrl: "/l.png" }));
    expect(page.publisher).toEqual({ "@type": "Organization", name: "Nimbus Linen", logo: `${siteUrl}/l.png` });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/seo/metadata.test.ts`
Expected: FAIL. `stripStoreSuffix` is not exported, and `generateMetadata` ignores its second argument (the title is "About Us | Sleep Sheet").

- [ ] **Step 3: Rewrite `lib/seo/metadata.ts`**

Replace the whole file with:

```ts
import { seoConfig } from "./config"
import type { Metadata } from "next"
import type { SeoMetadata } from "./types"

/** What page metadata needs from the store profile (lib/seo/page-metadata.ts builds it). */
export type SeoStore = { name: string; locale: string; defaultImage: string }

export interface MetadataParams {
  title: string
  description: string
  keywords?: string
  canonical?: string
  robots?: string
  openGraph?: SeoMetadata["openGraph"]
  twitter?: SeoMetadata["twitter"]
  alternates?: SeoMetadata["alternates"]
  noIndex?: boolean
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** "Comforters | Store …" → "Comforters": admin-entered SEO titles sometimes already end in the store name. */
export function stripStoreSuffix(title: string, storeName: string): string {
  const pattern = new RegExp(`\\s*\\|\\s*${escapeRegExp(storeName).replace(/\\? /g, "\\s*")}.*$`, "i")
  return title.replace(pattern, "").trim()
}

export function generateMetadata(
  { title, description, keywords, canonical, robots, openGraph, twitter, alternates, noIndex }: MetadataParams,
  store: SeoStore,
): Metadata {
  const fullTitle = `${title} | ${store.name}`
  const canonicalUrl = canonical || seoConfig.siteUrl
  const rawImage = openGraph?.image || store.defaultImage || "/logo.png"
  const ogImageUrl = rawImage.startsWith("http")
    ? rawImage
    : `${seoConfig.siteUrl}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`

  return {
    // { absolute } opts out of the root layout's `%s | <store>` template:
    // fullTitle already carries the store name once.
    title: { absolute: fullTitle },
    description,
    keywords,
    // "follow" even when noindexed: these pages (empty categories, /sale,
    // account/checkout) still link to real products worth crawling.
    robots: noIndex ? "noindex, follow" : robots || "index, follow, max-image-preview:large, max-snippet:-1",
    referrer: "origin-when-cross-origin",
    alternates: {
      canonical: canonicalUrl,
      ...(alternates?.languages ? { languages: alternates.languages } : {}),
    },
    openGraph: {
      title: openGraph?.title || fullTitle,
      description: openGraph?.description || description,
      url: canonicalUrl,
      siteName: store.name,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: openGraph?.imageAlt || title }],
      locale: openGraph?.locale || store.locale,
      // Coerce to a type Next's Metadata validator accepts; anything else
      // (e.g. "product") throws "Invalid OpenGraph type" at runtime.
      type: (["website", "article", "book", "profile"].includes(openGraph?.type as string)
        ? openGraph?.type
        : "website") as "website" | "article" | "book" | "profile",
    },
    twitter: {
      card: twitter?.card || "summary_large_image",
      site: twitter?.site,
      creator: twitter?.creator,
      title: twitter?.card ? undefined : fullTitle,
      description: twitter?.card ? undefined : description,
      images: [twitter?.image || ogImageUrl],
    },
    appleWebApp: { capable: true, statusBarStyle: "default", title: store.name },
    applicationName: store.name,
    // No `verification`: the root layout sets it, and a child value would replace it.
  }
}

export function generateProductMetadata(
  product: {
    name: string
    description: string
    slug: string
    images?: string[]
    price?: number
    rating?: number
    reviewCount?: number
  },
  store: SeoStore,
): Metadata {
  return generateMetadata(
    {
      title: product.name,
      description: product.description?.slice(0, 160) || `Shop ${product.name} at ${store.name}`,
      canonical: `${seoConfig.siteUrl}/shop/${product.slug}`,
      openGraph: {
        title: product.name,
        description: product.description?.slice(0, 200),
        image: product.images?.[0] || store.defaultImage,
        imageAlt: product.name,
        // Next's Metadata OG `type` union has no "product"; product
        // richness for Meta comes from the catalog feed + Pixel.
        type: "website",
      },
      twitter: { card: "summary_large_image" },
    },
    store,
  )
}

export function generateCategoryMetadata(
  category: { name: string; description?: string; slug: string; page?: number; noIndex?: boolean },
  store: SeoStore,
): Metadata {
  const canonical = `${seoConfig.siteUrl}/categories/${category.slug}${category.page && category.page > 1 ? `?page=${category.page}` : ""}`
  return generateMetadata(
    {
      noIndex: category.noIndex,
      title: category.name + (category.page && category.page > 1 ? ` - Page ${category.page}` : ""),
      description: category.description?.slice(0, 160) || `Browse our collection of ${category.name} at ${store.name}`,
      canonical,
      openGraph: { title: category.name, description: category.description?.slice(0, 200), type: "website" },
    },
    store,
  )
}

export function generateBlogMetadata(
  post: { title: string; excerpt?: string; slug: string; coverImage?: string; author?: { name: string } },
  store: SeoStore,
): Metadata {
  return generateMetadata(
    {
      title: post.title,
      description: post.excerpt?.slice(0, 160) || post.title,
      canonical: `${seoConfig.siteUrl}/blog/${post.slug}`,
      openGraph: {
        title: post.title,
        description: post.excerpt?.slice(0, 200),
        image: post.coverImage || store.defaultImage,
        imageAlt: post.title,
        type: "article",
      },
      twitter: { card: "summary_large_image" },
    },
    store,
  )
}

export function generatePaginatedMetadata(
  baseTitle: string,
  baseDescription: string,
  baseUrl: string,
  page: number,
  totalPages: number,
  store: SeoStore,
): Metadata {
  const isFirst = page <= 1
  const canonical = isFirst ? baseUrl : `${baseUrl}?page=${page}`
  const prevUrl = page > 1 ? `${baseUrl}?page=${page - 1}` : undefined
  const nextUrl = page < totalPages ? `${baseUrl}?page=${page + 1}` : undefined

  return {
    ...generateMetadata({ title: isFirst ? baseTitle : `${baseTitle} - Page ${page}`, description: baseDescription, canonical }, store),
    ...(prevUrl ? { alternates: { canonical, ...({ prev: prevUrl } as Record<string, unknown>) } } : {}),
    ...(nextUrl ? { alternates: { canonical, ...({ next: nextUrl } as Record<string, unknown>) } } : {}),
  }
}
```

Create `lib/seo/page-metadata.ts`:

```ts
// Server only — kept out of lib/seo/index.ts, which client components import.
import type { Metadata } from "next"
import { getSiteSeo, getStoreProfile } from "@/lib/settings/store"
import type { StoreProfile } from "@/lib/settings/store-profile"
import { generateMetadata, type MetadataParams, type SeoStore } from "@/lib/seo/metadata"

export async function seoStore(): Promise<SeoStore> {
  const [store, seo] = await Promise.all([getStoreProfile(), getSiteSeo()])
  return { name: store.name, locale: store.locale, defaultImage: seo.image }
}

/** `export const generateMetadata = () => pageMetadata((store) => ({ … }))` for a static page. */
export async function pageMetadata(build: (store: StoreProfile) => MetadataParams): Promise<Metadata> {
  const [store, seo] = await Promise.all([getStoreProfile(), getSiteSeo()])
  return generateMetadata(build(store), { name: store.name, locale: store.locale, defaultImage: seo.image })
}
```

In `lib/seo/index.ts`, add `export type { SeoStore, MetadataParams } from "./metadata"` and `stripStoreSuffix` to the metadata export list.

- [ ] **Step 4: Publisher-aware JSON-LD**

In `lib/seo/json-ld.tsx`:

1. Add, below the imports:
   ```ts
   export type Publisher = Pick<StoreProfile, "name" | "logoUrl">
   ```
2. Replace `webpageSchema` with:
   ```ts
   export function webpageSchema(title: string, description: string, url: string, publisher: Publisher) {
     return jsonLd({
       "@type": "WebPage",
       name: title,
       description,
       url,
       publisher: { "@type": "Organization", name: publisher.name, logo: absoluteUrl(publisher.logoUrl) },
       inLanguage: "en",
       dateModified: new Date().toISOString(),
     })
   }
   ```
3. In `productSchema`, change the seller line to:
   ```ts
       ...(product.sellerName || product.brand
         ? { seller: { "@type": "Organization", name: product.sellerName || product.brand } }
         : {}),
   ```
4. Change the signature of `articleSchema` to `articleSchema(post: BlogSeoData, publisher: Publisher)`. Inside it, replace `seoConfig.organization.name` (twice) with `publisher.name`. Replace the publisher logo `url:` value with `absoluteUrl(publisher.logoUrl)`.

In `lib/seo/types.ts`, add `sellerName?: string` to `ProductSeoData`, after `brand?: string`.

In `lib/utils.ts`, change `extractTags` to take the brand tag from its caller:

```ts
export function extractTags(title: string, content?: string, brandTag?: string): string[] {
  const genericTags = [
    "Best Comforters in Bangladesh",
    "Best Price Comforters in BD",
    ...(brandTag ? [brandTag] : []),
    "Premium Bedding Set BD",
    "Home Textile Bangladesh",
  ];
```

The rest of the function stays as it is.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test lib/seo/metadata.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Convert the pages**

Every page below follows the same two rules:
- **Metadata.** `export const metadata: Metadata = buildMetadata({...})` (or `generateMetadata({...})`) becomes `export const generateMetadata = () => pageMetadata((store) => ({...}))`. Import `pageMetadata` from `@/lib/seo/page-metadata` and drop `generateMetadata as buildMetadata` (and `type Metadata` if unused) from the `@/lib/seo` import. In descriptions, `seoConfig.siteName` becomes `store.name`.
- **Body JSON-LD.** The page component becomes `async` if it isn't already, and starts with `const store = await getStoreProfile();` (import from `@/lib/settings/store`). Every `seoConfig.siteName` and literal store name in it becomes `store.name`. Every `webpageSchema(…)` call gets `store` as its fourth argument. `seoConfig.siteUrl` stays.

Worked example. `app/(client)/about/page.tsx` becomes:

```tsx
import { seoConfig, webpageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import AboutBody from "@/components/about/about-body";

export const generateMetadata = () =>
  pageMetadata((store) => ({
    title: "About Us",
    description: `${store.name} is Bangladesh's online destination for premium comforter sets, bed sheets, and pillow covers — 100% twill cotton fabric with cash on delivery nationwide.`,
    canonical: `${seoConfig.siteUrl}/about`,
  }));

const AboutPage = async () => {
  const store = await getStoreProfile();
  const aboutUrl = `${seoConfig.siteUrl}/about`;

  return (
    <div className="container mx-auto px-4 py-12">
      {structuredDataScript(
        "webpage",
        webpageSchema(
          `About ${store.name}`,
          `${store.name} is Bangladesh's online destination for premium comforter sets, bed sheets, and pillow covers.`,
          aboutUrl,
          store,
        ),
      )}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ]),
      )}

      {/* Visible copy is bn/en translated client-side (useLanguage), same
          split as the homepage's SeoContent/SeoContentBody — the JSON-LD
          above stays static English, matching that existing convention. */}
      <AboutBody />
    </div>
  );
};

export default AboutPage;
```

Apply the same rules to the rest:

| File | Metadata (inside `pageMetadata((store) => ({ … }))`) | Body changes |
|---|---|---|
| `contact/page.tsx` | title/description/canonical unchanged | `webpageSchema(\`Contact ${store.name}\`, \`Get in touch with the ${store.name} team. Send us a message or reach out by phone or email.\`, contactUrl, store)` |
| `shipping-returns/page.tsx` | description `` `Delivery times, delivery charges, and our 7-day replacement guarantee at ${store.name}.` `` | add `store` as the 4th `webpageSchema` argument |
| `privacy-policy/page.tsx` | description `` `How ${store.name} collects, uses, and protects your personal information.` `` | `webpageSchema("Privacy Policy", \`How ${store.name} collects, uses, and protects your personal information.\`, \`${seoConfig.siteUrl}/privacy-policy\`, store)` |
| `terms-of-service/page.tsx` | description `` `Read the terms and conditions for shopping at ${store.name} — orders, payment, delivery, and our replacement guarantee.` `` | `webpageSchema("Terms of Service", \`Terms and conditions for shopping at ${store.name}.\`, \`${seoConfig.siteUrl}/terms-of-service\`, store)` |
| `testimonials/page.tsx` | description `` `Real reviews from ${store.name} customers — see what people are saying about our comforter sets, bed sheets, and pillow covers.` `` | `webpageSchema(\`Customer Reviews \| ${store.name}\`, \`Real reviews from ${store.name} customers.\`, \`${seoConfig.siteUrl}/testimonials\`, store)` |
| `sale/page.tsx` | description `` `Sales and special offers at ${store.name}.` `` (keep every other field as it is) | none |
| `shop/page.tsx` | description with `store.name` | `collectionPageSchema(\`All Products \| ${store.name}\`, …)` |
| `new-arrivals/page.tsx` | description with `store.name` | `collectionPageSchema(\`New Arrivals \| ${store.name}\`, …)` |
| `bestsellers/page.tsx` | description with `store.name` | `collectionPageSchema(\`Bestsellers \| ${store.name}\`, …)` |
| `blog/page.tsx` | description `` `Read our latest stories, sleep tips, product guides, and news from ${store.name}.` `` | `webpageSchema(\`Blog \| ${store.name}\`, …, store)` |
| `sitemap/page.tsx` | description with `store.name` | `collectionPageSchema(\`Sitemap \| ${store.name}\`, \`Every page, category, product and guide at ${store.name}.\`, url, ld)` and the visible `{seoConfig.siteName}` (line 103) becomes `{store.name}` |
| `page.tsx` (home) | none (the root layout provides it) | `webpageSchema(seo.title, seo.description, seoConfig.siteUrl, store)` (`store` comes from Task 8) |

Pages that already have an async `generateMetadata`:

- `categories/[value]/page.tsx`:
  - Replace lines 35-40 (comment + `categoryTitle`) with:
    ```ts
    // seoTitle is admin-entered and some already end in "| <store name>" — the
    // metadata helper appends the store name itself, so strip it here.
    function categoryTitle(category: { seoTitle: string | null; label: string }, storeName: string): string {
      return stripStoreSuffix(category.seoTitle || category.label, storeName) || category.label;
    }
    ```
  - `categoryHeading(category, storeName)` calls `categoryTitle(category, storeName)`.
  - `categoryDescription(label, storeName)` uses `` `… at ${storeName}. …` ``.
  - In `generateMetadata`, add `const store = await seoStore();` and pass `store` as the second argument to `generateCategoryMetadata`. Use `store.name` in the two helper calls.
  - In the page body, add `const store = await getStoreProfile();` and pass `store.name` to `categoryHeading` and `categoryDescription`.
  - Import `stripStoreSuffix` from `@/lib/seo` and `seoStore` from `@/lib/seo/page-metadata`.
- `shop/[slug]/page.tsx`:
  - In `generateMetadata`, add `const store = await seoStore();` and pass it as the second argument to `generateProductMetadata`.
  - In the page body, add `const store = await getStoreProfile();` to the start of `ProductDetailPage`. In `productSchema({...})`, replace `brand: seoConfig.siteName,` with `brand: store.name, sellerName: store.name,`.
- `blog/[slug]/page.tsx`:
  - Replace the comment on lines 72-73 with `// The root layout's title template already appends the store name.`
  - In `generateMetadata`, add `const store = await getStoreProfile();` at the top. Change `extractTags(post.title, post.content)` to `extractTags(post.title, post.content, \`${store.name} Bangladesh\`)` and the fallback description to `` `Read ${fallbackTitle} on ${store.name}` ``.
- `blog/[slug]/blog-post-client.tsx` (client component): add `const store = useStoreProfile();` (from `@/hooks/use-store-profile`) at the top of the component, and pass `store` as the second argument to `articleSchema(...)`.
- `videos/videos-content.tsx`:
  - Change the signature to `videosMetadata(items: ProductVideoItem[], store: SeoStore, sharedSlug?: string): Metadata`. Pass `store` as the second argument to both `buildMetadata(...)` calls. Replace every `seoConfig.siteName` in it with `store.name`.
  - Change `VideosContent` to `VideosContent({ items, storeName }: { items: ProductVideoItem[]; storeName: string })` and use `storeName` in the two JSON-LD strings.
- `videos/page.tsx`: `return videosMetadata(await getVideoItems(), await seoStore());` and `return <VideosContent items={await getVideoItems()} storeName={(await getStoreProfile()).name} />;`.
- `videos/share/[slug]/page.tsx`: `return videosMetadata(await getVideoItems(), await seoStore(), slug);` and the same `storeName` prop.

In `components/home/seo-content.tsx`:
- Change `buildFaqs` to `buildFaqs(insideDhaka: number, outsideDhaka: number, storeName: string)`. In the three questions/answers that name the store (lines 15, 32, 35), replace the literal name with `${storeName}`, using template literals.
- In `SeoContent`, pass `storeProfileFromSettings(settings).name` as the third argument. Import `storeProfileFromSettings` from `@/lib/settings/store-profile`.

In `lib/seo/metadata.ts`, the old comment mentioning "| Sleep Sheet | Sleep Sheet" is already gone (Step 3).

- [ ] **Step 7: Verify**

Run: `pnpm typecheck`
Expected: no errors. Any caller still missing the new `store` or `publisher` argument fails here. Fix each one with the rules above.

Run: `grep -rnE "seoConfig\.(siteName|organization|contact|address|defaultTitle|defaultDescription|defaultLocale|socialLinks|verification)" app lib/seo --include=*.ts --include=*.tsx | grep -v "lib/seo/config.ts"`
Expected: no output.

Run: `pnpm test && pnpm lint "app/(client)" lib/seo components/home lib/utils.ts`
Expected: all PASS and no lint errors.

Manual check (`pnpm dev`): with Site Name temporarily set to `Nimbus Linen`, `/shop`, `/blog`, `/categories/comforters` and one product page all show `<title>… | Nimbus Linen</title>`, once each, and `og:site_name` is `Nimbus Linen`. Set the name back.

- [ ] **Step 8: Commit**

```bash
git add lib/seo/metadata.ts lib/seo/metadata.test.ts lib/seo/page-metadata.ts lib/seo/json-ld.tsx lib/seo/types.ts lib/seo/index.ts lib/utils.ts components/home/seo-content.tsx \
  "app/(client)/about/page.tsx" "app/(client)/contact/page.tsx" "app/(client)/shipping-returns/page.tsx" \
  "app/(client)/privacy-policy/page.tsx" "app/(client)/terms-of-service/page.tsx" "app/(client)/testimonials/page.tsx" \
  "app/(client)/sale/page.tsx" "app/(client)/shop/page.tsx" "app/(client)/new-arrivals/page.tsx" \
  "app/(client)/bestsellers/page.tsx" "app/(client)/blog/page.tsx" "app/(client)/sitemap/page.tsx" "app/(client)/page.tsx" \
  "app/(client)/categories/[value]/page.tsx" "app/(client)/shop/[slug]/page.tsx" "app/(client)/blog/[slug]/page.tsx" \
  "app/(client)/blog/[slug]/blog-post-client.tsx" "app/(client)/videos/videos-content.tsx" "app/(client)/videos/page.tsx" \
  "app/(client)/videos/share/[slug]/page.tsx"
git commit -F - <<'EOF'
feat(seo): page metadata and JSON-LD name the store from settings

Static pages switch to generateMetadata through pageMetadata(), and
every page-level title, og:site_name, publisher and FAQ answer takes the
store name from the profile instead of a constant. Admin-typed category
titles are stripped of the current store name, not a hardcoded one.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 10: Client copy, invoice and dashboard labels name the store

**Files:**
- Create: `lib/db-literal.ts`
- Create: `lib/db-literal.test.ts`
- Create: `hooks/use-language.test.ts`
- Modify: `hooks/use-language.ts` (22 strings, plus `t()`)
- Modify: `components/about/about-body.tsx`, `components/contact/contact-body.tsx`, `components/shipping-returns/shipping-returns-body.tsx`, `components/privacy-policy/privacy-policy-body.tsx`, `components/terms-of-service/terms-of-service-body.tsx`
- Modify: `features/product/components/product-policy-accordion.tsx`, `features/product/components/product-grid-fallback.tsx`, `features/product/components/switch-image.tsx`
- Modify: `features/checkout/components/invoice-pdf.tsx:5,262-296,480-505`
- Modify: `components/footer.tsx`, `app/(client)/client-layout.tsx:144-156`, `components/nav-bar.tsx:236,485-516`, `components/product/reels-viewer.tsx:507`, `components/app-sidebar.tsx:251`
- Modify: `app/(client)/order-success/page.tsx:285`, `app/(client)/orders/[orderId]/order-actions.tsx:17,77`
- Modify: `app/(dashboard)/dashboard/pos/pos-client.tsx:107-116`, `app/(dashboard)/dashboard/orders/page.tsx:768-773`, `app/(dashboard)/dashboard/analytics/page.tsx:7`
- Modify: `features/settings/components/pos-facebook-pages.tsx:222`, `features/settings/components/website-form.tsx:254,358,372,427`, `features/settings/components/social-manager-form.tsx:38`, `features/seo/components/seo-form.tsx:38-45,112,126,237`
- Modify: `features/google-sheets/server/route.ts:13-52,83,123`, `features/analytics/server/route.ts:72-84`, `features/reports/server/route.ts:194-206`
- Modify: `lib/meta-catalog/config.ts:8`, `lib/meta-catalog/README.md:128`
- Modify: the pages that render `ProductGridFallback` (`shop`, `new-arrivals`, `bestsellers`, `categories/[value]`)

**Interfaces:**
- Consumes: `useStoreProfile`, `fillStore`, `getSetting("site_name")`, `STORE_DEFAULTS`, `SEO_DEFAULTS`.
- Produces from `lib/db-literal.ts`: `pgStringLiteral(value: string): string` and `posChannelSql(storeName: string): SQL`.
- `useLanguage().t(key)` fills a `{store}` placeholder with `store.nameBn` (bn) or `store.name` (en).
- `InvoicePDF` / `BulkInvoicePDF` props: `phoneNumber` becomes required `string`. New optional prop `timeZone?: string` (wired in Task 11).
- `ProductGridFallback` gets a new required prop `storeName: string`.
- `Footer` gets a new prop `siteName: string`.

- [ ] **Step 1: Write the failing tests**

Create `lib/db-literal.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pgStringLiteral } from "@/lib/db-literal";

describe("pgStringLiteral", () => {
  it("quotes a value", () => {
    expect(pgStringLiteral("Nimbus Linen (POS)")).toBe("'Nimbus Linen (POS)'");
  });

  it("doubles single quotes so a store name cannot break out of the literal", () => {
    expect(pgStringLiteral("Rahim's Store'); drop table orders; --")).toBe("'Rahim''s Store''); drop table orders; --'");
  });
});
```

Create `hooks/use-language.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { translations } from "@/hooks/use-language";

describe("translations", () => {
  it("name the store only through the {store} placeholder", () => {
    const all = JSON.stringify(translations);
    expect(all).not.toMatch(/Sleep Sheet|স্লিপ শীট|স্লিপ শিটের/);
    expect(all).toContain("{store}");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test lib/db-literal.test.ts hooks/use-language.test.ts`
Expected: FAIL. `@/lib/db-literal` cannot be resolved, and the translations still contain the store name.

- [ ] **Step 3: Implement `lib/db-literal.ts`**

```ts
import { sql, type SQL } from "drizzle-orm";

/**
 * A Postgres string literal (standard_conforming_strings is on, the default
 * since 9.1, so doubling single quotes is the whole escape).
 *
 * For expressions that appear in both SELECT and GROUP BY: a bound
 * parameter becomes $1 in one place and $2 in the other, and Postgres
 * won't treat them as the same grouped expression.
 */
export function pgStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** The channel label for a POS order with no Facebook page, e.g. "Nimbus Linen (POS)". */
export function posChannelSql(storeName: string): SQL {
  return sql.raw(pgStringLiteral(`${storeName} (POS)`));
}
```

- [ ] **Step 4: `{store}` in the dictionary**

In `hooks/use-language.ts`, replace the store name with `{store}` on exactly these lines (current line numbers):
- English `"Sleep Sheet"`: 145, 152, 163, 164, 181, 187, 192, 231, 244, 245, 350.
- Bangla `"স্লিপ শীট"`: 490, 497, 508, 509, 526, 532, 537, 677, 686, 687.
- Bangla `"স্লিপ শিট"` on line 576: replace only the store-name part, so `"গুগল ম্যাপে স্লিপ শিটের লোকেশন"` becomes `"গুগল ম্যাপে {store}ের লোকেশন"`.

Do not touch product-type uses of "sleep sheet" (lower case) or of "স্লিপ শিট" elsewhere.

Change `useLanguage()`:

```ts
import { useStoreProfile } from "./use-store-profile";
import { fillStore } from "@/lib/settings/store-profile";

export function useLanguage() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  // From the seeded ["settings"] query: no request of its own.
  const store = useStoreProfile();

  useEffect(() => {
    hydrateLanguageStore();
  }, []);

  const t = (key: keyof (typeof translations)["en"]) => {
    const val = translations[language]?.[key] ?? translations["bn"]?.[key];
    return val !== undefined ? fillStore(val, store, language) : key;
  };

  return { language, setLanguage, t };
}
```

- [ ] **Step 5: Client components read the profile**

In each file, add `const store = useStoreProfile();` (from `@/hooks/use-store-profile`) at the top of the component, and drop the `seoConfig` import if `siteUrl` is no longer used.

| File | Replace | With |
|---|---|---|
| `components/about/about-body.tsx` | `seoConfig.contact.telephone` / `seoConfig.contact.email` | `store.phone` / `store.email` |
| `components/contact/contact-body.tsx` | `seoConfig.contact.email` / `.telephone` | `store.email` / `store.phone` |
| `components/shipping-returns/shipping-returns-body.tsx` | `seoConfig.siteName`, `seoConfig.contact.*` | `store.name`, `store.email` / `store.phone` |
| `components/privacy-policy/privacy-policy-body.tsx` | `seoConfig.siteName`, `seoConfig.contact.*`, `seoConfig.address.streetAddress`, `seoConfig.address.addressLocality` | `store.name`, `store.email` / `store.phone`, `store.address`, `store.city` (keep `seoConfig.siteUrl`) |
| `components/terms-of-service/terms-of-service-body.tsx` | same as privacy | same as privacy |
| `features/product/components/product-policy-accordion.tsx` | line 38 `"স্লিপ শিট থেকে কেনাকাটার…"` and line 65 `"Thank you for shopping with Sleep Sheet. …"` | `"{store} থেকে কেনাকাটার…"` and `"Thank you for shopping with {store}. …"`; render `{fillStore(policy.intro, store, lang)}`; contact line uses `store.phone` / `store.email` |
| `features/product/components/switch-image.tsx:134` | `` `${product.name} – Sleep Sheet Bangladesh` `` | `` `${product.name} – ${siteName} Bangladesh` ``, with `const { siteName } = useWebsiteSettings();` |
| `components/product/reels-viewer.tsx:507` | `alt="Sleep Sheet"` | `alt={siteName}`, with `const { siteName } = useWebsiteSettings();` in that component |
| `components/nav-bar.tsx:236,486,516` | `alt={siteName \|\| "SleepSheet Logo"}` | `` alt={`${siteName} logo`} `` |
| `components/nav-bar.tsx:485,515` | `aria-label={siteName \|\| "SleepSheet Home"}` | `` aria-label={`${siteName} home`} `` |
| `components/app-sidebar.tsx:251` | `>Sleep Sheet<` | `>{storeProfileFromSettings(settings).name}<` (this component already has `useSettings()`; import `storeProfileFromSettings`) |
| `app/(client)/order-success/page.tsx:285` | `আসসালামু আলাইকুম Sleep Sheet!` | `` আসসালামু আলাইকুম ${siteName}! `` (`siteName` is already destructured on line 52) |
| `app/(client)/orders/[orderId]/order-actions.tsx:17` | `const { footerPhone } = useWebsiteSettings();` | `const { footerPhone, siteName } = useWebsiteSettings();` |
| `app/(client)/orders/[orderId]/order-actions.tsx:77` | `(footerPhone \|\| "+8801570241052")` and `Hello Sleep Sheet,` | `footerPhone` and `` Hello ${siteName}, `` |
| `app/(dashboard)/dashboard/pos/pos-client.tsx:107-116` | each `"Sleep Sheet"` fallback | `siteName`, with `const { siteName } = useWebsiteSettings();` |
| `app/(dashboard)/dashboard/orders/page.tsx:768-773` | each `name: "Sleep Sheet"` | `name: siteName` (`siteName` is on line 762) |
| `app/(dashboard)/dashboard/analytics/page.tsx:7` | `title: "Analytics \| Sleep Sheet Admin",` | `title: "Analytics",` (the root template adds the store name) |

Footer: in `components/footer.tsx`, add `siteName: string;` to `FooterProps` and to the destructured props, and change the logo `alt` to `` {`${siteName} logo`} ``. In `app/(client)/client-layout.tsx`, add `siteName,` to the `useWebsiteSettings()` destructure and pass `siteName={siteName}` to `<Footer>`.

`features/product/components/product-grid-fallback.tsx` (server component): add `storeName: string` to its props and use `` `${product.name} – ${storeName} Bangladesh` `` on line 48. Then pass `storeName={store.name}` at each `<ProductGridFallback …/>` in `app/(client)/shop/page.tsx`, `new-arrivals/page.tsx`, `bestsellers/page.tsx` and `categories/[value]/page.tsx`. Each of those pages already has `store` from Task 9; add `const store = await getStoreProfile();` where it does not.

- [ ] **Step 6: Invoice**

In `features/checkout/components/invoice-pdf.tsx`:

1. Replace line 5 with `import { seoConfig } from "@/lib/seo";` (kept for `siteUrl`) and add `import { STORE_DEFAULTS } from "@/lib/settings/defaults";`.
2. In `InvoicePDFProps` and `BulkInvoicePDFProps`, make `phoneNumber: string;` required and add `timeZone?: string;`. Thread `timeZone` through `BulkInvoicePDF` into `InvoicePDFPage`.
3. Line 294: replace `sleepsheetbd.com` with `{new URL(seoConfig.siteUrl).host}`.
4. Line 295: replace `{phoneNumber || seoConfig.contact.telephone}` with `{phoneNumber}`.
5. Line 307: add `timeZone: timeZone ?? STORE_DEFAULTS.timezone` to the `toLocaleString` options.

Run `pnpm typecheck`. Every invoice caller that omitted `phoneNumber` fails. Pass `footerPhone` from `useWebsiteSettings()` there; the dashboard orders page, order-success and track-order already destructure it.

- [ ] **Step 7: Admin forms and server labels**

- `features/settings/components/pos-facebook-pages.tsx:222`: placeholder `"e.g. Main Page, Outlet Page"`.
- `features/settings/components/website-form.tsx`:
  - line 254: placeholder `"Your store name"`
  - line 358: placeholder `"support@example.com"`
  - line 372: placeholder `"House 1, Road 2, Dhaka 1200"`
  - line 427: placeholder `"© 2026 Your Store. All rights reserved."`
- `features/settings/components/social-manager-form.tsx:38`: `https://social.example.com`.
- `features/seo/components/seo-form.tsx`:
  - Import `{ SEO_DEFAULTS, STORE_DEFAULTS }` from `@/lib/settings/defaults`.
  - Lines 38-40 use `STORE_DEFAULTS.name`, `SEO_DEFAULTS.title` and `SEO_DEFAULTS.description` as the fallbacks.
  - Line 45 becomes `seo_twitter_handle: data?.seo_twitter_handle || "",`.
  - Placeholders on lines 112, 126 and 237: `"Your store name"`, `"Your store — what you sell"`, `"@yourstore"`.
- `features/google-sheets/server/route.ts`:
  - `formatOrderChannel(saleType, reference, storeName: string)` returns `` `${storeName} (POS)` `` for a POS order with no reference.
  - `toSheetRow(order, storeName: string)` passes it on.
  - In both handlers, read `const storeName = await getSetting("site_name");` (from `@/lib/settings/read`). Call `toSheetRow(order, storeName)` on line 83 and `targetOrders.map((o) => toSheetRow(o, storeName))` on line 123.
- `features/analytics/server/route.ts` (the `pageRef` CASE, around line 76) and `features/reports/server/route.ts` (around line 198):
  - Before `const pageRef = sql…`, add `const posChannel = posChannelSql(await getSetting("site_name"));`.
  - Replace `THEN 'Sleep Sheet (POS)'` with `THEN ${posChannel}`.
  - Import `posChannelSql` from `@/lib/db-literal` and `getSetting` from `@/lib/settings/read`. The CASE is used in SELECT and GROUP BY, which is why it is a raw literal and not a parameter (see `lib/db-literal.ts`).
- `lib/meta-catalog/config.ts:8`: `brandFallback: STORE_DEFAULTS.name,` (import from `@/lib/settings/defaults`). `lib/meta-catalog/README.md:128`: `brandFallback: STORE_DEFAULTS.name,`.

- [ ] **Step 8: Verify, including the acceptance grep**

Run: `pnpm test lib/db-literal.test.ts hooks/use-language.test.ts && pnpm typecheck && pnpm test`
Expected: all PASS and no type errors.

Run: `grep -rn "Sleep Sheet" app components features lib hooks`
Expected: only `lib/settings/defaults.ts`, and `*.test.ts` files if any.

Run: `grep -rnE "SleepSheet|SLEEP SHEET|sleepsheet2025|support@sleepsheet" app components features lib hooks`
Expected: only `lib/settings/defaults.ts` and test files.

Run: `pnpm lint`
Expected: no errors.

Manual check (`pnpm dev`):
- Switch the site language on `/about`. The heading reads "About Sleep Sheet" / "স্লিপ শীট সম্পর্কে", the same as before.
- Print an invoice from `/dashboard/orders`. It shows the store phone and `sleepsheetbd.com`.

- [ ] **Step 9: Commit**

```bash
git add lib/db-literal.ts lib/db-literal.test.ts hooks/use-language.ts hooks/use-language.test.ts \
  components/about/about-body.tsx components/contact/contact-body.tsx components/shipping-returns/shipping-returns-body.tsx \
  components/privacy-policy/privacy-policy-body.tsx components/terms-of-service/terms-of-service-body.tsx \
  components/footer.tsx components/nav-bar.tsx components/product/reels-viewer.tsx components/app-sidebar.tsx \
  features/product/components/product-policy-accordion.tsx features/product/components/product-grid-fallback.tsx \
  features/product/components/switch-image.tsx features/checkout/components/invoice-pdf.tsx \
  "app/(client)/client-layout.tsx" "app/(client)/order-success/page.tsx" "app/(client)/orders/[orderId]/order-actions.tsx" \
  "app/(client)/track-order/page.tsx" "app/(client)/shop/page.tsx" "app/(client)/new-arrivals/page.tsx" \
  "app/(client)/bestsellers/page.tsx" "app/(client)/categories/[value]/page.tsx" \
  "app/(dashboard)/dashboard/pos/pos-client.tsx" "app/(dashboard)/dashboard/orders/page.tsx" "app/(dashboard)/dashboard/analytics/page.tsx" \
  features/settings/components/pos-facebook-pages.tsx features/settings/components/website-form.tsx \
  features/settings/components/social-manager-form.tsx features/seo/components/seo-form.tsx \
  features/google-sheets/server/route.ts features/analytics/server/route.ts features/reports/server/route.ts \
  lib/meta-catalog/config.ts lib/meta-catalog/README.md
# If typecheck made you touch another invoice caller, add it by path too (check `git status`). Never `git add -A`.
git commit -F - <<'EOF'
feat(store): name the store from settings in copy, invoice and labels

Translations name the store through a {store} placeholder filled from
the profile; policy pages, the invoice, footer, nav, WhatsApp messages,
POS fallbacks and the POS channel label in reports read the store name
and contact details from settings. "Sleep Sheet" now appears only in
lib/settings/defaults.ts.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 11: Wire the business rules

**Files:**
- Create: `lib/settings/business-rules.ts`
- Create: `lib/settings/business-rules.test.ts`
- Modify: `features/checkout/server/route.ts:234,439`
- Modify: `features/pos/server/route.ts:135`
- Modify: `features/analytics/server/route.ts:622,659`
- Modify: `app/(dashboard)/dashboard/orders/page.tsx:1244,1339`
- Modify: `app/(dashboard)/dashboard/products/client.tsx:110`

**Interfaces:**
- Consumes: `getSetting` (Task 4), `BUSINESS_DEFAULTS`, `useSettings`, `useStoreProfile`.
- Produces from `lib/settings/business-rules.ts` (zod-free, client-safe): `type BusinessRules = { invoiceLanguage: "bn" | "en"; defaultProductCategory: string }` and `businessRulesFromSettings(s?: Record<string, string | undefined> | null): BusinessRules`.
- Server reads use `getSetting("order_number_prefix")`, `getSetting("pos_order_number_prefix")` and `getSetting("low_stock_threshold")`. The `business` group has no credentials, so these are cached under `settings:business`.

- [ ] **Step 1: Write the failing test**

Create `lib/settings/business-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BUSINESS_DEFAULTS } from "@/lib/settings/defaults";
import { businessRulesFromSettings } from "@/lib/settings/business-rules";

describe("businessRulesFromSettings", () => {
  it("falls back to the defaults", () => {
    expect(businessRulesFromSettings(null)).toEqual({
      invoiceLanguage: BUSINESS_DEFAULTS.invoiceLanguage,
      defaultProductCategory: BUSINESS_DEFAULTS.defaultProductCategory,
    });
  });

  it("uses saved values", () => {
    expect(businessRulesFromSettings({ invoice_language: "en", default_product_category: "Bedsheet" })).toEqual({
      invoiceLanguage: "en",
      defaultProductCategory: "Bedsheet",
    });
  });

  it("prints Bangla invoices for anything but en", () => {
    expect(businessRulesFromSettings({ invoice_language: "fr" }).invoiceLanguage).toBe("bn");
  });

  it("opens on all products when the admin clears the default category", () => {
    expect(businessRulesFromSettings({ default_product_category: "" }).defaultProductCategory).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/settings/business-rules.test.ts`
Expected: FAIL. The import cannot be resolved.

- [ ] **Step 3: Implement `lib/settings/business-rules.ts`**

```ts
import { BUSINESS_DEFAULTS } from "@/lib/settings/defaults";

/** Business rules the dashboard reads from the settings map (zod-free, so client code may import it). */
export type BusinessRules = { invoiceLanguage: "bn" | "en"; defaultProductCategory: string };

export function businessRulesFromSettings(s?: Readonly<Record<string, string | undefined>> | null): BusinessRules {
  const category = s?.default_product_category;
  return {
    invoiceLanguage: s?.invoice_language === "en" ? "en" : s?.invoice_language === "bn" ? "bn" : BUSINESS_DEFAULTS.invoiceLanguage,
    // A saved empty value means "all categories"; only a never-saved one falls back.
    defaultProductCategory: category === undefined ? BUSINESS_DEFAULTS.defaultProductCategory : category.trim(),
  };
}
```

Run: `pnpm test lib/settings/business-rules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Wire the readers**

`features/checkout/server/route.ts`:
- Add `import { getSetting as getTypedSetting } from "@/lib/settings/read";`. The file already imports the legacy string `getSetting`; keep that one.
- At both `withOrderNumber("ORD", …)` sites (lines 234 and 439), write `const orderPrefix = await getTypedSetting("order_number_prefix");` on the line before, and call `withOrderNumber(orderPrefix, …)`.

`features/pos/server/route.ts`:
- Add `import { getSetting } from "@/lib/settings/read";`.
- Before line 135, add `const orderPrefix = await getSetting("pos_order_number_prefix");` and call `withOrderNumber(orderPrefix, …)`.

`features/analytics/server/route.ts` (`getSetting` is imported in Task 10):
- `/low-stock`: replace `const threshold = 10;` (line 622) with `const threshold = await getSetting("low_stock_threshold");`.
- `/overview`: replace `const LOW_STOCK_THRESHOLD = 10;` (line 659) with `const LOW_STOCK_THRESHOLD = await getSetting("low_stock_threshold");`.

`app/(dashboard)/dashboard/orders/page.tsx`:
- After `const { data: settings } = useSettings();` (line 763), add:
  ```ts
    const { invoiceLanguage } = businessRulesFromSettings(settings);
    const { timezone } = useStoreProfile();
  ```
  Import `businessRulesFromSettings` from `@/lib/settings/business-rules` and `useStoreProfile` from `@/hooks/use-store-profile`.
- Replace `language="bn"` on lines 1244 and 1339 with `language={invoiceLanguage}`. Add `timeZone={timezone}` next to each.

`app/(dashboard)/dashboard/products/client.tsx`:
- Add `const { data: settings } = useSettings();` above the query states (import `useSettings` from `@/features/settings/api/use-settings`) and `const { defaultProductCategory } = businessRulesFromSettings(settings);`.
- Change line 110 to:
  ```ts
    const [categoryId, setCategoryId] = useQueryState("category", parseAsString.withDefault(defaultProductCategory))
  ```

- [ ] **Step 5: Verify**

Run: `pnpm test && pnpm typecheck && pnpm lint features/checkout features/pos features/analytics "app/(dashboard)/dashboard/orders/page.tsx" "app/(dashboard)/dashboard/products/client.tsx" lib/settings`
Expected: all PASS, no errors.

Manual check (`pnpm dev`):
- In `/dashboard/settings/business`, set the website prefix to `WEB` and the low-stock threshold to `3`.
- Place a COD test order. Its number starts `WEB-`.
- The dashboard Low Stock card lists only products with stock ≤ 3.
- Set the invoice language to English, then print an invoice from `/dashboard/orders`. The labels are English.
- Restore `ORD`, `10` and `bn`.

- [ ] **Step 6: Commit**

```bash
git add lib/settings/business-rules.ts lib/settings/business-rules.test.ts features/checkout/server/route.ts features/pos/server/route.ts features/analytics/server/route.ts "app/(dashboard)/dashboard/orders/page.tsx" "app/(dashboard)/dashboard/products/client.tsx"
git commit -F - <<'EOF'
feat(settings): order prefixes, low-stock threshold and invoice rules

Website and POS order-number prefixes, the low-stock threshold, the
dashboard invoice language and time zone, and the products page's
default category now come from the business rules settings instead of
code. Defaults match the old behaviour.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 12: Remove the hardcoded fallbacks and the dead keys

**Files:**
- Create: `lib/gtm/container.ts`
- Create: `lib/gtm/container.test.ts`
- Create: `features/google-sheets/product-cache-webhook.ts`
- Create: `features/google-sheets/product-cache-webhook.test.ts`
- Create: `mcp-server/src/tools/ga4-property.ts`
- Create: `mcp-server/src/tools/ga4-property.test.ts`
- Create (generated, custom): `db/migrations/0035_settings_white_label.sql`, plus updates to `db/migrations/meta/_journal.json` and a new `db/migrations/meta/0035_snapshot.json`
- Modify: `components/google-analytics.tsx:45-67,104,162`
- Modify: `features/seo/components/seo-form.tsx` (remove `seo_site_name`; add `gtm_server_url`)
- Modify: `features/google-sheets/server/route.ts:200-203`
- Modify: `mcp-server/src/tools/ga4.ts:6,23,25,31,61-62,73,77,83,116,127,137,161`
- Modify: `lib/print-receipt.ts:20-31`, `app/(client)/orders/[orderId]/order-actions.tsx:35-49`
- Modify: `next.config.ts:118-121`
- Modify: `lib/settings/registry.ts` and `lib/settings/registry.test.ts` (drop the dead keys)
- Modify: `lib/cdn-purge.ts:1`, `lib/gtm/index.ts:63` (comments)
- Delete: `features/dashboard/components/dashboard-navbar.tsx`, `features/dashboard/components/dashboard-sidebar.tsx` (only after Step 6 confirms nothing imports them)

**Interfaces:**
- Consumes: the registry, `isValidSocialManagerUrl`.
- Produces:
  - `gtmContainer(settings: Record<string, string> | null | undefined, envId?: string): { id: string; host: string } | null` from `lib/gtm/container.ts`.
  - `productCacheWebhookUrl(env?): string | null` from `features/google-sheets/product-cache-webhook.ts`.
  - `resolveGa4PropertyId(requested: string | undefined, env?): string` from `mcp-server/src/tools/ga4-property.ts`.
- Dead keys deleted: `seo_site_name`, `gtm_server_id`, `google_analytics_id`, `ga4_property_id`. `gtm_server_url` is wired as the GTM host.

- [ ] **Step 1: Write the failing tests**

Create `lib/gtm/container.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gtmContainer } from "@/lib/gtm/container";

describe("gtmContainer", () => {
  it("loads the container saved in settings from the saved first-party host", () => {
    expect(gtmContainer({ gtm_web_id: "GTM-ABC123", gtm_server_url: "https://ss.example.com/" })).toEqual({
      id: "GTM-ABC123",
      host: "https://ss.example.com",
    });
  });

  it("falls back to Google's host when no server container is saved", () => {
    expect(gtmContainer({ gtm_web_id: "GTM-ABC123" })?.host).toBe("https://www.googletagmanager.com");
  });

  it("uses the env id when settings have none", () => {
    expect(gtmContainer({}, "GTM-ENV1")?.id).toBe("GTM-ENV1");
  });

  it("loads nothing rather than a hardcoded container", () => {
    expect(gtmContainer({})).toBeNull();
    expect(gtmContainer(undefined)).toBeNull();
  });

  it("ignores a malformed id", () => {
    expect(gtmContainer({ gtm_web_id: "UA-1234" })).toBeNull();
  });
});
```

Create `features/google-sheets/product-cache-webhook.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { productCacheWebhookUrl } from "@/features/google-sheets/product-cache-webhook";

describe("productCacheWebhookUrl", () => {
  it("is the configured URL", () => {
    expect(productCacheWebhookUrl({ N8N_PRODUCT_CACHE_WEBHOOK_URL: "https://n8n.example/webhook/x" })).toBe(
      "https://n8n.example/webhook/x",
    );
  });

  it("is null when unset, instead of a hardcoded instance", () => {
    expect(productCacheWebhookUrl({})).toBeNull();
  });
});
```

Create `mcp-server/src/tools/ga4-property.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveGa4PropertyId } from "@/mcp-server/src/tools/ga4-property";

describe("resolveGa4PropertyId", () => {
  it("prefers the requested property", () => {
    expect(resolveGa4PropertyId("111", { GA4_PROPERTY_ID: "222" })).toBe("111");
  });

  it("falls back to GA4_PROPERTY_ID", () => {
    expect(resolveGa4PropertyId(undefined, { GA4_PROPERTY_ID: "222" })).toBe("222");
  });

  it("refuses rather than querying a hardcoded property", () => {
    expect(() => resolveGa4PropertyId(undefined, {})).toThrow(/GA4_PROPERTY_ID/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test lib/gtm/container.test.ts features/google-sheets/product-cache-webhook.test.ts mcp-server/src/tools/ga4-property.test.ts`
Expected: FAIL. None of the three modules exist.

- [ ] **Step 3: Implement the three helpers**

`lib/gtm/container.ts`:

```ts
/**
 * Which GTM container to load, and from where. Both come from settings
 * (gtm_web_id, gtm_server_url): the server container on the VPS serves
 * gtm.js from a first-party subdomain so blockers that match
 * googletagmanager.com don't drop it. No hardcoded fallback — a store
 * without a container loads none.
 */
const GOOGLE_HOST = "https://www.googletagmanager.com";

export type GtmContainer = { id: string; host: string };

export function gtmContainer(settings: Record<string, string> | null | undefined, envId?: string): GtmContainer | null {
  const id = settings?.gtm_web_id?.trim() || envId?.trim() || "";
  if (!/^GTM-[A-Z0-9]+$/.test(id)) return null;
  const host = (settings?.gtm_server_url?.trim() || GOOGLE_HOST).replace(/\/+$/, "");
  return { id, host };
}
```

`features/google-sheets/product-cache-webhook.ts`:

```ts
/** The n8n product-cache webhook, or null when this deployment has none. */
export function productCacheWebhookUrl(env: Record<string, string | undefined> = process.env): string | null {
  return env.N8N_PRODUCT_CACHE_WEBHOOK_URL?.trim() || null;
}
```

`mcp-server/src/tools/ga4-property.ts`:

```ts
/** The GA4 property to query: the tool argument, else GA4_PROPERTY_ID. Never a hardcoded store's property. */
export function resolveGa4PropertyId(
  requested: string | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  const id = requested?.trim() || env.GA4_PROPERTY_ID?.trim();
  if (!id) throw new Error("GA4 property ID missing: pass propertyId or set GA4_PROPERTY_ID");
  return id;
}
```

Run: `pnpm test lib/gtm/container.test.ts features/google-sheets/product-cache-webhook.test.ts mcp-server/src/tools/ga4-property.test.ts`
Expected: PASS (5 + 2 + 3 tests).

- [ ] **Step 4: Use them**

`components/google-analytics.tsx`:
1. Delete `DEFAULT_GTM_ID`, `GTM_HOST` and their comment (lines 45-49). Add `import { gtmContainer } from "@/lib/gtm/container";`.
2. Replace the `gtmWebId` block (lines 63-67) with:
   ```ts
     // From settings (gtm_web_id / gtm_server_url), else NEXT_PUBLIC_GTM_ID.
     // A store with neither loads no container at all.
     const container = gtmContainer(settings, process.env.NEXT_PUBLIC_GTM_ID);
     const src = container ? `${container.host}/gtm.js?id=${container.id}` : null;
   ```
3. In the effect:
   - Change the guard to `if (isDashboard || typeof window === "undefined" || !src) return;`.
   - Delete the inner `const src = …` line.
   - Change the dependency array to `[isDashboard, isOrderSuccess, src]`.
4. Change `if (isDashboard) return null;` to `if (isDashboard || !container) return null;`. In the `<noscript>` iframe, use `` src={`${container.host}/ns.html?id=${container.id}`} ``.
5. Update the comment block above the effect: "falls back to the constant" becomes "comes from settings".

`features/google-sheets/server/route.ts`: replace lines 200-203 (the `webhookUrl` const with its fallback) with:

```ts
        const webhookUrl = productCacheWebhookUrl();
        if (!webhookUrl) {
          return c.json({ error: "Product cache sync is not configured (N8N_PRODUCT_CACHE_WEBHOOK_URL)" }, 503);
        }
```

Import `productCacheWebhookUrl` from `@/features/google-sheets/product-cache-webhook`.

`mcp-server/src/tools/ga4.ts`:
- Delete line 6 (`DEFAULT_PROPERTY_ID`). Add `import { resolveGa4PropertyId } from "./ga4-property.js";`; the `.js` suffix matches the file's other relative import.
- Replace every `propertyId || DEFAULT_PROPERTY_ID` with `resolveGa4PropertyId(propertyId)`.
- In the tool descriptions and the error note, replace `for Property ID 546802046`, `for property 546802046`, `(default: 546802046)` and `on GA4 Property 546802046` with `for the configured property`, `(default: GA4_PROPERTY_ID)` and `on the GA4 property`.

`lib/print-receipt.ts`: make `siteName: string;` required in `PrintReceiptOptions` and give `siteDescription` the default `""` (remove `"LUXSTORE"` and `"Premium Fashion & Accessories"`). In `app/(client)/orders/[orderId]/order-actions.tsx`, add `siteName,` to the `printReceipt({ … })` call (`siteName` is destructured in Task 10).

`next.config.ts`: delete the `luxstore.lenishmagar.me` entry from `images.remotePatterns` (lines 118-121). The custom loader does not consult `remotePatterns`, so this changes no rendering.

Reword two comments: in `lib/cdn-purge.ts` line 1, "in front of sleepsheetbd.com" becomes "in front of the site". In `lib/gtm/index.ts` line 63, "(ss.sleepsheetbd.com)" becomes "(the gtm_server_url host)".

- [ ] **Step 5: Drop the dead keys**

In `lib/settings/registry.ts`, delete the four lines marked `// dead: removed in Task 12` (`seo_site_name`, `google_analytics_id`, `ga4_property_id`, `gtm_server_id`). In `lib/settings/registry.test.ts`, delete those four names from `LEGACY_KEYS` and add:

```ts
  it("no longer accepts the four dead keys", () => {
    for (const key of ["seo_site_name", "gtm_server_id", "google_analytics_id", "ga4_property_id"]) {
      expect(isSettingKey(key), key).toBe(false);
    }
  });
```

In `features/seo/components/seo-form.tsx`:
- Delete `seo_site_name` from `seoSchema`, from the `values` object, from `onSubmit`, and the `<FormField … name="seo_site_name" …/>` block (around lines 105-118).
- Add `gtm_server_url: z.string().optional(),` to `seoSchema`, `gtm_server_url: data?.gtm_server_url || "",` to `values`, and `gtm_server_url: values.gtm_server_url?.trim() || undefined,` to `onSubmit`.
- Add this field directly after the `gtm_web_id` `FormField`:

```tsx
                <FormField
                  control={form.control}
                  name="gtm_server_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GTM server container URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://ss.example.com" className="rounded-xl font-mono text-sm" />
                      </FormControl>
                      <FormDescription>
                        First-party host that serves gtm.js. Leave empty to load from Google.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
```

Generate the data migration:

Run: `pnpm db:generate --custom --name settings_white_label`
(drizzle-kit `generate` does not connect to the database. If it complains about `DATABASE_URL`, prefix the command with `DATABASE_URL=postgres://x:x@127.0.0.1:1/x`.)
Expected: an empty `db/migrations/0035_settings_white_label.sql`, plus a journal entry. Fill it with exactly:

```sql
-- SP-1 Task 12. Data only; the site_settings table is unchanged.
-- 1. The code no longer falls back to a hardcoded GTM container or host,
--    so make sure production has both saved. A value the admin already
--    saved wins; an empty one is filled.
INSERT INTO "site_settings" ("key", "value") VALUES ('gtm_web_id', 'GTM-PQ667JWQ')
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
WHERE "site_settings"."value" = '';
--> statement-breakpoint
INSERT INTO "site_settings" ("key", "value") VALUES ('gtm_server_url', 'https://ss.sleepsheetbd.com')
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
WHERE "site_settings"."value" = '';
--> statement-breakpoint
-- 2. Keys nothing reads any more.
DELETE FROM "site_settings" WHERE "key" IN ('seo_site_name', 'gtm_server_id', 'google_analytics_id', 'ga4_property_id');
```

- [ ] **Step 6: Delete the dead dashboard components**

Run: `grep -rn "dashboard-navbar\|dashboard-sidebar\|DashboardNavbar\|DashboardSidebar" app components features lib | grep -v "^features/dashboard/components/dashboard-navbar.tsx\|^features/dashboard/components/dashboard-sidebar.tsx"`
Expected: no output. If anything is printed, do not delete; replace the `Luxestore` / `LUXESTORE` text in those two files with `{siteName}` from `useWebsiteSettings()` instead.

If the output was empty: `git rm features/dashboard/components/dashboard-navbar.tsx features/dashboard/components/dashboard-sidebar.tsx`.

- [ ] **Step 7: Verify**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all PASS, no errors.

Run: `grep -rniE "luxe?store|lenishmagar|GTM-PQ667JWQ|546802046|n8n\.sleepsheetbd|ss\.sleepsheetbd" app components features lib hooks provider mcp-server/src next.config.ts | grep -v "features/auth/constants.ts"`
Expected: no output. `features/auth/constants.ts` keeps `luxestore-session` until Task 14.

Run: `grep -rn "sleepsheetbd" app components features lib hooks | grep -v "\.test\.ts"`
Expected: only `lib/settings/defaults.ts` (`DEFAULT_SITE_URL`).

- [ ] **Step 8: Commit**

```bash
git add lib/gtm/container.ts lib/gtm/container.test.ts lib/gtm/index.ts components/google-analytics.tsx features/google-sheets/product-cache-webhook.ts features/google-sheets/product-cache-webhook.test.ts features/google-sheets/server/route.ts mcp-server/src/tools/ga4-property.ts mcp-server/src/tools/ga4-property.test.ts mcp-server/src/tools/ga4.ts lib/print-receipt.ts "app/(client)/orders/[orderId]/order-actions.tsx" next.config.ts lib/settings/registry.ts lib/settings/registry.test.ts features/seo/components/seo-form.tsx lib/cdn-purge.ts db/migrations/0035_settings_white_label.sql db/migrations/meta
git commit -F - <<'EOF'
fix(white-label): drop hardcoded GTM, n8n, GA4 and LUXSTORE fallbacks

GTM's container and first-party host now come only from settings
(gtm_server_url is finally read), the n8n product-cache sync returns
503 when its webhook is unset, and the MCP GA4 tools require a
property. The LUXSTORE receipt default, the luxstore image host and the
four dead settings keys are removed. Migration 0035 backfills the two
GTM keys and deletes the dead rows; the owner applies it before deploy.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

If Step 6 deleted the two dashboard components, they are already staged by `git rm` and go into this commit.

- [ ] **Step 9 (owner, before the push that contains this task): Apply the migration**

Follow "Deployment order" step 3.

---

### Task 13: Revoke API keys and OAuth tokens when a password changes

**Files:**
- Create: `lib/revoke-credentials.ts`
- Create: `lib/revoke-credentials.test.ts`
- Modify: `features/auth/server/route.ts:215-259` (self-service password change)
- Modify: `features/users/server/route.ts:230-252` (admin password reset)

**Interfaces:**
- Consumes: `apiKeys`, `oauthAccessTokens` and `oauthRefreshTokens` from `db/schema.ts`.
- Produces: `revokeUserCredentials(conn: Pick<typeof db, "update">, userId: string, now?: Date): Promise<RevokedCounts>` and `type RevokedCounts = { apiKeys: number; oauthAccessTokens: number; oauthRefreshTokens: number }`.
- The self-service change response gains `revoked: RevokedCounts`. The admin reset's activity log gains a "Credentials: Revoked" change.

- [ ] **Step 1: Write the failing test**

Create `lib/revoke-credentials.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { revokeUserCredentials } from "@/lib/revoke-credentials";

// Real Postgres (PGlite): the subset of each table the update touches.
let client: PGlite;
let db: ReturnType<typeof drizzle>;
const EARLIER = new Date("2026-01-01T00:00:00Z");
const NOW = new Date("2026-10-11T12:00:00Z");

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  for (const table of ["api_keys", "oauth_access_tokens", "oauth_refresh_tokens"]) {
    await db.execute(sql.raw(`create table ${table} (id text primary key, "userId" text not null, "revokedAt" timestamp(3))`));
  }
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  for (const table of ["api_keys", "oauth_access_tokens", "oauth_refresh_tokens"]) {
    await db.execute(sql.raw(`delete from ${table}`));
    await db.execute(
      sql.raw(`insert into ${table} (id, "userId", "revokedAt") values
        ('a', 'u1', null), ('b', 'u1', '${EARLIER.toISOString()}'), ('c', 'u2', null)`),
    );
  }
});

async function revokedAt(table: string, id: string) {
  const res = await db.execute<{ revokedAt: string | null }>(sql.raw(`select "revokedAt" from ${table} where id = '${id}'`));
  return res.rows[0]?.revokedAt ? new Date(res.rows[0].revokedAt + "Z").toISOString() : null;
}

describe("revokeUserCredentials", () => {
  it("revokes the user's live keys and tokens", async () => {
    const counts = await revokeUserCredentials(db as never, "u1", NOW);
    expect(counts).toEqual({ apiKeys: 1, oauthAccessTokens: 1, oauthRefreshTokens: 1 });
    for (const table of ["api_keys", "oauth_access_tokens", "oauth_refresh_tokens"]) {
      expect(await revokedAt(table, "a")).toBe(NOW.toISOString());
    }
  });

  it("keeps the original date on something already revoked", async () => {
    await revokeUserCredentials(db as never, "u1", NOW);
    expect(await revokedAt("api_keys", "b")).toBe(EARLIER.toISOString());
  });

  it("leaves other users alone", async () => {
    await revokeUserCredentials(db as never, "u1", NOW);
    expect(await revokedAt("api_keys", "c")).toBeNull();
    expect(await revokedAt("oauth_refresh_tokens", "c")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/revoke-credentials.test.ts`
Expected: FAIL. The import of `@/lib/revoke-credentials` cannot be resolved.

- [ ] **Step 3: Implement `lib/revoke-credentials.ts`**

```ts
import { and, eq, isNull } from "drizzle-orm";
import type { db } from "@/db";
import { apiKeys, oauthAccessTokens, oauthRefreshTokens } from "@/db/schema";

export type RevokedCounts = { apiKeys: number; oauthAccessTokens: number; oauthRefreshTokens: number };

/**
 * A new password ends every credential the old one stood behind: the user's
 * API keys and their MCP OAuth access and refresh tokens (SP-0 parked item;
 * sessions are already revoked by the tokenVersion bump). Already-revoked
 * rows keep their original date. Sequential, so it also runs inside a
 * transaction.
 */
export async function revokeUserCredentials(
  conn: Pick<typeof db, "update">,
  userId: string,
  now: Date = new Date(),
): Promise<RevokedCounts> {
  const keys = await conn
    .update(apiKeys)
    .set({ revokedAt: now })
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  const access = await conn
    .update(oauthAccessTokens)
    .set({ revokedAt: now })
    .where(and(eq(oauthAccessTokens.userId, userId), isNull(oauthAccessTokens.revokedAt)))
    .returning({ id: oauthAccessTokens.id });
  const refresh = await conn
    .update(oauthRefreshTokens)
    .set({ revokedAt: now })
    .where(and(eq(oauthRefreshTokens.userId, userId), isNull(oauthRefreshTokens.revokedAt)))
    .returning({ id: oauthRefreshTokens.id });
  return { apiKeys: keys.length, oauthAccessTokens: access.length, oauthRefreshTokens: refresh.length };
}
```

Run: `pnpm test lib/revoke-credentials.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Call it on both password paths**

`features/auth/server/route.ts`:
- Add `import { revokeUserCredentials, type RevokedCounts } from "@/lib/revoke-credentials";`.
- After `invalidateSessionUser(user.id);`, add:
  ```ts
      // A new password also ends the API keys and MCP tokens the old one stood behind.
      let revoked: RevokedCounts | undefined;
      if (body.newPassword) revoked = await revokeUserCredentials(db, user.id);
  ```
- Change the final `return c.json({ data: updated });` to `return c.json({ data: updated, ...(revoked ? { revoked } : {}) });`.

`features/users/server/route.ts`:
- Add `import { revokeUserCredentials } from "@/lib/revoke-credentials";`.
- After `invalidateSessionUser(id);` in the password-reset handler, add `const revoked = await revokeUserCredentials(db, id);`.
- Replace the `changes` array in the `setActivityMeta` call that follows with:
  ```ts
        changes: [
          { label: "Password", to: "Reset by admin" },
          ...(revoked.apiKeys + revoked.oauthAccessTokens + revoked.oauthRefreshTokens > 0
            ? [{ label: "Credentials", to: `Revoked ${revoked.apiKeys} API key(s), ${revoked.oauthAccessTokens + revoked.oauthRefreshTokens} OAuth token(s)` }]
            : []),
        ],
  ```

- [ ] **Step 5: Verify**

Run: `pnpm test && pnpm typecheck && pnpm lint features/auth features/users lib/revoke-credentials.ts`
Expected: all PASS, no errors.

Manual check (`pnpm dev`):
- Create an API key in `/dashboard/settings/api-keys` and check that it works: `curl -H "Authorization: Bearer <key>" localhost:3000/api/auth/current` returns your user.
- Change your password in the account page. Run the same curl again: it now returns no user.
- The API keys list shows the key as revoked.

- [ ] **Step 6: Commit**

```bash
git add lib/revoke-credentials.ts lib/revoke-credentials.test.ts features/auth/server/route.ts features/users/server/route.ts
git commit -F - <<'EOF'
fix(security): revoke API keys and OAuth tokens on password change

A password change or admin reset already signed out every session via
tokenVersion, but the user's API keys and MCP OAuth tokens kept working.
Both paths now revoke them too, and the admin reset records it in the
activity log. Closes the item parked after SP-0.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

Tell the owner when handing over: after this deploys, changing your own password revokes your own API keys. n8n or MCP clients that use one need a new key.

---

### Task 14 (OWNER-GATED: do not deploy without the owner — renames the login cookie): Rename the `luxestore-session` cookie

> The brief expects this rename to log everyone out once. With the transition below, it should not: the old cookie is still accepted, and it is re-issued under the new name on the next API request. A mistake here would still log everyone out, so the owner picks the deploy time (a low-traffic hour, staff told beforehand; brief §8 item 6). Commit it, but **do not push until the owner says so**. Seven days after it is live, a follow-up commit deletes `LEGACY_AUTH_COOKIE` and the fallback in `readSessionCookie`.

**Files:**
- Create: `features/auth/constants.test.ts`
- Modify: `features/auth/constants.ts` (whole file)
- Modify: `features/auth/server/route.ts:4,10,17-23,138,165,253`
- Modify: `lib/session-middleware.ts:9,83-119`
- Modify: `lib/get-session-user.ts:6,15`
- Modify: `lib/is-authenticated.ts:7,12`
- Modify: `proxy.ts:4,19`

**Interfaces:**
- Consumes: nothing new.
- Produces from `features/auth/constants.ts`:
  - `AUTH_COOKIE = "store_session"`
  - `LEGACY_AUTH_COOKIE = "luxestore-session"`
  - `SESSION_COOKIE_OPTIONS`
  - `readSessionCookie(get: (name: string) => string | undefined): { token: string; legacy: boolean } | null`

- [ ] **Step 1: Write the failing test**

Create `features/auth/constants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AUTH_COOKIE, LEGACY_AUTH_COOKIE, readSessionCookie } from "@/features/auth/constants";

const jar = (cookies: Record<string, string>) => (name: string) => cookies[name];

describe("session cookie", () => {
  it("has a name that doesn't carry another store's brand", () => {
    expect(AUTH_COOKIE).toBe("store_session");
    expect(AUTH_COOKIE).not.toMatch(/lux/i);
  });

  it("reads the new cookie", () => {
    expect(readSessionCookie(jar({ [AUTH_COOKIE]: "new" }))).toEqual({ token: "new", legacy: false });
  });

  it("falls back to the old cookie name, so the rename logs nobody out", () => {
    expect(readSessionCookie(jar({ [LEGACY_AUTH_COOKIE]: "old" }))).toEqual({ token: "old", legacy: true });
  });

  it("prefers the new cookie when both are present", () => {
    expect(readSessionCookie(jar({ [AUTH_COOKIE]: "new", [LEGACY_AUTH_COOKIE]: "old" }))?.token).toBe("new");
  });

  it("returns null without a session", () => {
    expect(readSessionCookie(jar({}))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test features/auth/constants.test.ts`
Expected: FAIL. `LEGACY_AUTH_COOKIE` and `readSessionCookie` are not exported, and `AUTH_COOKIE` is still `"luxestore-session"`.

- [ ] **Step 3: Rewrite `features/auth/constants.ts`**

```ts
export const AUTH_COOKIE = "store_session";

/**
 * The cookie's name before SP-1. Still read (never written) so the rename
 * logs nobody out: session-middleware re-issues it under AUTH_COOKIE on the
 * next API request. Delete this and the fallback below 7 days after the
 * rename deploys (the JWT lifetime).
 */
export const LEGACY_AUTH_COOKIE = "luxestore-session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days, matches the JWT
} as const;

export function readSessionCookie(get: (name: string) => string | undefined): { token: string; legacy: boolean } | null {
  const current = get(AUTH_COOKIE);
  if (current) return { token: current, legacy: false };
  const legacy = get(LEGACY_AUTH_COOKIE);
  return legacy ? { token: legacy, legacy: true } : null;
}
```

Run: `pnpm test features/auth/constants.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 4: Use it everywhere the cookie is read or written**

`lib/session-middleware.ts`:
1. Change the cookie import to `import { getCookie, deleteCookie, setCookie } from 'hono/cookie'` and the constants import to `import { AUTH_COOKIE, LEGACY_AUTH_COOKIE, SESSION_COOKIE_OPTIONS, readSessionCookie } from '@/features/auth/constants'`.
2. Replace `const token = getCookie(c, AUTH_COOKIE)` and its `if (!token)` block with:
   ```ts
     const session = readSessionCookie((name) => getCookie(c, name))

     if (!session) {
       c.set('user', null)
       return await next()
     }
     const token = session.token
     // Pre-rename cookie (features/auth/constants.ts): move it to the new name.
     const migrateLegacyCookie = () => {
       if (!session.legacy) return
       setCookie(c, AUTH_COOKIE, token, SESSION_COOKIE_OPTIONS)
       deleteCookie(c, LEGACY_AUTH_COOKIE, { path: "/" })
     }
   ```
3. Call `migrateLegacyCookie()` right before `c.set('user', cached.user)` in the cache-hit branch, and right before `c.set('user', sessionUser)` at the end of the DB branch.
4. In the two failure branches, change `deleteCookie(c, AUTH_COOKIE, { path: "/" })` to:
   ```ts
       deleteCookie(c, AUTH_COOKIE, { path: "/" })
       deleteCookie(c, LEGACY_AUTH_COOKIE, { path: "/" })
   ```

`lib/get-session-user.ts` and `lib/is-authenticated.ts`: import `readSessionCookie` instead of `AUTH_COOKIE`. Replace the token line with:
- `const token = readSessionCookie((name) => cookieStore.get(name)?.value)?.token;` in `get-session-user.ts`
- `const store = await cookieStore; const token = readSessionCookie((name) => store.get(name)?.value)?.token;` in `is-authenticated.ts`

`proxy.ts`: import `readSessionCookie` instead of `AUTH_COOKIE`, and change line 19 to `const token = readSessionCookie((name) => request.cookies.get(name)?.value)?.token;`.

`features/auth/server/route.ts`:
- Change line 10 to `import { AUTH_COOKIE, LEGACY_AUTH_COOKIE, SESSION_COOKIE_OPTIONS } from "../constants";` and delete the local `SESSION_COOKIE_OPTIONS` (lines 17-23).
- After `setCookie(c, AUTH_COOKIE, token, SESSION_COOKIE_OPTIONS);` in `/login` (line 138), add `deleteCookie(c, LEGACY_AUTH_COOKIE, { path: "/" });`.
- In `/logout`, after the `deleteCookie(c, AUTH_COOKIE, …)` call, add `deleteCookie(c, LEGACY_AUTH_COOKIE, { path: "/" });`.

- [ ] **Step 5: Verify**

Run: `pnpm test && pnpm typecheck && pnpm lint features/auth lib/session-middleware.ts lib/get-session-user.ts lib/is-authenticated.ts proxy.ts`
Expected: all PASS, no errors.

Run: `grep -rn "luxestore" app components features lib hooks proxy.ts | grep -v "\.test\.ts"`
Expected: only the `LEGACY_AUTH_COOKIE` line in `features/auth/constants.ts`.

Manual transition check (`pnpm dev`):
1. Check out the commit before this task, sign in, and note the `luxestore-session` cookie in devtools.
2. Switch back to this commit and restart. Reload `/dashboard`: you are still signed in.
3. After the first API call (`/api/auth/current`), devtools shows `store_session` and no `luxestore-session`.
4. Sign out. Both cookies are gone.

- [ ] **Step 6: Commit (do not push)**

```bash
git add features/auth/constants.ts features/auth/constants.test.ts features/auth/server/route.ts lib/session-middleware.ts lib/get-session-user.ts lib/is-authenticated.ts proxy.ts
git commit -F - <<'EOF'
fix(auth): rename the luxestore-session cookie to store_session

The login cookie still carried another store's brand. The old name is
still read for one JWT lifetime and silently re-issued under the new
one, so the rename should log nobody out. Owner-gated: deploy at a
low-traffic hour, then drop LEGACY_AUTH_COOKIE after 7 days.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 7 (owner, 7 days after deploy): Remove the transition**

Delete `LEGACY_AUTH_COOKIE` and the fallback branch of `readSessionCookie`, the `migrateLegacyCookie` helper, and the extra `deleteCookie(…LEGACY_AUTH_COOKIE…)` calls. Delete the "falls back to the old cookie name" test. Commit as `chore(auth): stop reading the pre-rename session cookie`.

---

### SP-1 exit checklist

- [ ] All 14 tasks committed. Database and env steps done in the order given in "Deployment order" (steps 2 and 3 before their pushes; step 4 encryption done and checked with psql; Task 14 deployed only with the owner).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green locally, and `verify` green in Actions.
- [ ] Brief §4 SP-1 acceptance:
  - [ ] `grep -rn "Sleep Sheet" app components features lib hooks` matches only `lib/settings/defaults.ts` and tests.
  - [ ] Changing the store name or phone in the admin updates page titles, JSON-LD, footer and invoice after saving, with no deploy (Task 8 and Task 10 manual checks, repeated on production with a harmless edit and an immediate revert).
  - [ ] Secret rows start with `enc:v1:` (psql check, Deployment order step 4).
  - [ ] Tests cover the registry (`lib/settings/registry.test.ts`), the crypto (`lib/settings/crypto.test.ts`, `parse.test.ts`) and the write permissions (`lib/settings/write.test.ts`, `features/settings/settings-fields.test.ts`).
- [ ] Mobile Lighthouse for Home, Product and Checkout within 3 points of the baseline in `brief.md` §2, CLS ≤ 0.1.
- [ ] `docs/brief.md` updated: SP-1 marked done, with the date and what remains open (the Task 14 transition removal; the deferred items in "Review Focus").
