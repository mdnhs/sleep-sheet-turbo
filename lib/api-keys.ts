import { randomBytes, createHash } from "crypto";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";

// Prefix makes a leaked key recognizable at a glance (in logs, in a commit
// diff, in a support ticket) and lets us version the format later without
// breaking old keys.
const KEY_PREFIX = "sk_live_";

/** Cryptographically random raw key — shown to the user exactly once. */
export function generateRawApiKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

/** SHA-256 is fine here (not bcrypt): the key itself is already high-entropy
 * random data, not a human-guessable password, so there's nothing for a slow
 * hash to protect against beyond what a fast hash already does. */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/** Short, safe-to-display fragment for the management UI, e.g. "sk_live_a1b2c3d4…". */
export function displayPrefix(rawKey: string): string {
  return `${rawKey.slice(0, KEY_PREFIX.length + 8)}…`;
}

export type ApiKeyUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  phone: string | null;
  address: string | null;
};

/**
 * Resolve a raw `Authorization: Bearer <key>` value to the user who owns it,
 * exactly like session-middleware resolves a login cookie to a user — same
 * shape, so every existing route's `hasPermission`/`role` check works
 * unmodified regardless of which auth path was used. Also stamps
 * `lastUsedAt` so a key that's been silently unused for months is visible in
 * the management UI. Returns null for a missing, unknown, or revoked key —
 * callers treat that the same as "no session".
 */
export async function authenticateApiKey(rawKey: string): Promise<ApiKeyUser | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;

  const keyHash = hashApiKey(rawKey);
  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)),
  });
  if (!row) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, row.userId),
    with: { assignedRole: true },
  });
  if (!user) return null;

  // Best-effort — a failed timestamp update must never block authentication.
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch((err) => console.error("[api-keys] failed to stamp lastUsedAt", err));

  const isSuperAdmin = user.email === process.env.SUPER_ADMIN_EMAIL;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: isSuperAdmin ? "ADMIN" : user.role,
    permissions: user.assignedRole ? user.assignedRole.permissions : [],
    phone: user.phone,
    address: user.address,
  };
}
