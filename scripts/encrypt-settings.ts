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
    if (!apply) {
      const { rows } = await pool.query<{ key: string; value: string }>("select key, value from site_settings");
      const updates = planEncryption(rows, key);
      console.log(`${updates.length} plaintext credential row(s): ${updates.map((u) => u.key).join(", ") || "none"}`);
      console.log("Dry run. Re-run with --apply to write.");
      return;
    }

    // Read inside the transaction with row locks, so a concurrent admin save
    // can't be overwritten by a stale plaintext value.
    const client = await pool.connect();
    let updates: { key: string; value: string }[];
    try {
      await client.query("begin");
      const { rows } = await client.query<{ key: string; value: string }>(
        "select key, value from site_settings for update",
      );
      updates = planEncryption(rows, key);
      console.log(`${updates.length} plaintext credential row(s): ${updates.map((u) => u.key).join(", ") || "none"}`);
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
    if (updates.length === 0) return;

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
