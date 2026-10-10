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
