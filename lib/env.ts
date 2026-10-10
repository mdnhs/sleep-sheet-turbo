import { z } from "zod";
import { isValidSettingsKey } from "@/lib/settings/crypto";

// Every var the app reads via `process.env.X!` (non-null assertion) used to
// fail with a confusing runtime error the first time that code path ran —
// e.g. jwt.sign() throwing deep inside a login request if JWT_SECRET was
// unset, instead of the real problem ("you forgot to configure the app")
// being obvious at boot. Validating here, in instrumentation.ts's register(),
// means a misconfigured deploy fails immediately and clearly instead.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Required — the app cannot serve a single request without these.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET should be at least 32 characters"),

  // Used to build the checkout-time guest customer email fallback and to
  // grant the ADMIN role by email match (see lib/session-middleware.ts).
  SUPER_ADMIN_EMAIL: z.string().email().optional(),

  // CORS allowlist for the /api/** Hono app (see app/api/[[...route]]/route.ts).
  TRUSTED_ORIGINS: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Meta Pixel / Conversions API — optional, features no-op when unset.
  META_PIXEL_ID: z.string().optional(),
  META_CAPI_ACCESS_TOKEN: z.string().optional(),
  META_TEST_EVENT_CODE: z.string().optional(),

  // SEO verification tags / analytics — optional, feature no-ops when unset.
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_VERIFICATION: z.string().optional(),
  NEXT_PUBLIC_BING_VERIFICATION: z.string().optional(),
  NEXT_PUBLIC_YANDEX_VERIFICATION: z.string().optional(),
  GA4_PROPERTY_ID: z.string().optional(),

  // Cloudflare edge cache purge on content writes and after deploys — optional,
  // no-op when unset. See lib/cdn-purge.ts.
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  CLOUDFLARE_PURGE_TOKEN: z.string().optional(),
  // n8n webhook for realtime order alerts (e.g. to Telegram) — optional,
  // feature no-ops when unset. See lib/n8n-notify.
  N8N_ORDER_WEBHOOK_URL: z.string().url().optional(),
  // n8n webhook that forwards unexpected API errors to Telegram (optional).
  N8N_ERROR_WEBHOOK_URL: z.string().url().optional(),
  // n8n webhook for direct product cache sync from /dashboard/images
  N8N_PRODUCT_CACHE_WEBHOOK_URL: z.string().url().optional(),
  // AES-256-GCM key for credentials in site_settings (lib/settings/crypto.ts).
  // Optional: without it credentials stay plaintext. Malformed fails boot,
  // rather than leaving every credential unreadable.
  SETTINGS_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine((value) => !value || !value.trim() || isValidSettingsKey(value), {
      message: "must be 32 random bytes, base64-encoded (openssl rand -base64 32)",
    }),
});

export type Env = z.infer<typeof envSchema>;

// Exported for tests — lets them exercise the validation rules directly
// without going through validateEnv()'s module-level cache.
export { envSchema };

let cached: Env | undefined;

/** Validate process.env once and cache the result. Throws with every problem listed, not just the first. */
export function validateEnv(): Env {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = result.data;
  return cached;
}
