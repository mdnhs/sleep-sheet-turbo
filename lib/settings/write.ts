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
