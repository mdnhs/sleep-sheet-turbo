/**
 * One-off backfill: seal credentials already stored as plaintext in
 * site_settings (see lib/settings/crypto.ts).
 *
 *   SETTINGS_ENCRYPTION_KEY must be set (openssl rand -base64 32).
 *   pnpm tsx --env-file=.env scripts/encrypt-settings.ts           # dry run, lists key names
 *   pnpm tsx --env-file=.env scripts/encrypt-settings.ts --apply   # writes
 *
 * Idempotent: already-sealed, empty and unregistered rows are left alone.
 * Prints setting key names only, never values.
 */
import { eq } from "drizzle-orm";
import { getSettingsKey } from "../lib/settings/crypto";
import { planEncryption } from "../lib/settings/encrypt-rows";

async function main() {
  const apply = process.argv.includes("--apply");
  const key = getSettingsKey();
  if (!key) {
    console.error("SETTINGS_ENCRYPTION_KEY is not set; nothing to do.");
    process.exitCode = 1;
    return;
  }

  // Imported lazily so a missing key exits before any database connection.
  const { db } = await import("../db/index");
  const { siteSettings } = await import("../db/schema");

  const rows = await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
  const plan = planEncryption(rows, key);

  if (plan.length === 0) {
    console.log("No plaintext credentials found.");
    return;
  }

  if (!apply) {
    console.log(`Dry run: ${plan.length} credential(s) would be encrypted:`);
    for (const row of plan) console.log(`  - ${row.key}`);
    console.log("Re-run with --apply to write.");
    return;
  }

  await db.transaction(async (tx) => {
    for (const row of plan) {
      await tx
        .update(siteSettings)
        .set({ value: row.value, updatedAt: new Date() })
        .where(eq(siteSettings.key, row.key));
    }
  });
  console.log(`Encrypted ${plan.length} credential(s):`);
  for (const row of plan) console.log(`  - ${row.key}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
