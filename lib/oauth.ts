import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { db } from "@/db";
import {
  oauthClients,
  oauthAuthorizationCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
  users,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { ApiKeyUser } from "@/lib/api-keys";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes, single-use

function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("hex")}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time string compare — avoids leaking token contents via timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ---- Dynamic Client Registration (RFC 7591) ----

export async function registerClient(input: { clientName: string; redirectUris: string[] }) {
  const clientId = randomToken("mcp_client_", 16);
  const clientSecret = randomToken("mcp_secret_", 24);

  await db.insert(oauthClients).values({
    id: clientId,
    clientSecretHash: sha256(clientSecret),
    clientName: input.clientName,
    redirectUris: input.redirectUris,
  });

  return { clientId, clientSecret };
}

export async function getClient(clientId: string) {
  return db.query.oauthClients.findFirst({ where: eq(oauthClients.id, clientId) });
}

// ---- PKCE (RFC 7636) ----

/** code_challenge = BASE64URL(SHA256(code_verifier)) for the required "S256" method. */
export function verifyPkce(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method !== "S256") return false; // "plain" is against MCP's spec — never accept it
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return safeEqual(computed, codeChallenge);
}

// ---- Authorization code (minted on consent, redeemed once at /oauth/token) ----

export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}) {
  const code = randomToken("mcp_code_", 24);
  await db.insert(oauthAuthorizationCodes).values({
    code,
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
  });
  return code;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function issueTokenPair(clientId: string, userId: string): Promise<TokenPair> {
  const accessToken = randomToken("mcp_at_");
  const refreshToken = randomToken("mcp_rt_");

  await db.insert(oauthAccessTokens).values({
    tokenHash: sha256(accessToken),
    clientId,
    userId,
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
  });
  await db.insert(oauthRefreshTokens).values({
    tokenHash: sha256(refreshToken),
    clientId,
    userId,
  });

  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_MS / 1000 };
}

/**
 * POST /oauth/token, grant_type=authorization_code. Validates the code is
 * real, unexpired, unused, bound to this client+redirect_uri, and that the
 * caller's code_verifier actually hashes to the code_challenge stored when
 * the code was minted. Marks the code used either way (never redeemable
 * twice, even on a failed attempt) — a reused code is a strong signal of
 * interception, so failing safe here matters more than being lenient.
 */
export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenPair | { error: string }> {
  const record = await db.query.oauthAuthorizationCodes.findFirst({
    where: eq(oauthAuthorizationCodes.code, input.code),
  });

  if (!record) return { error: "invalid_grant" };

  // Consume it now, before any validation branches, so a code can never be
  // retried after a failed exchange either.
  if (!record.usedAt) {
    await db
      .update(oauthAuthorizationCodes)
      .set({ usedAt: new Date() })
      .where(eq(oauthAuthorizationCodes.code, input.code));
  }

  if (record.usedAt) return { error: "invalid_grant" }; // already redeemed
  if (record.expiresAt.getTime() < Date.now()) return { error: "invalid_grant" };
  if (record.clientId !== input.clientId) return { error: "invalid_grant" };
  if (record.redirectUri !== input.redirectUri) return { error: "invalid_grant" };
  if (!verifyPkce(input.codeVerifier, record.codeChallenge, record.codeChallengeMethod)) {
    return { error: "invalid_grant" };
  }

  return issueTokenPair(record.clientId, record.userId);
}

/** POST /oauth/token, grant_type=refresh_token. Rotates the refresh token
 * on every use — see the schema comment on oauthRefreshTokens for why. */
export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
}): Promise<TokenPair | { error: string }> {
  const tokenHash = sha256(input.refreshToken);
  const record = await db.query.oauthRefreshTokens.findFirst({
    where: and(eq(oauthRefreshTokens.tokenHash, tokenHash), isNull(oauthRefreshTokens.revokedAt)),
  });

  if (!record) return { error: "invalid_grant" };
  if (record.clientId !== input.clientId) return { error: "invalid_grant" };

  await db.update(oauthRefreshTokens).set({ revokedAt: new Date() }).where(eq(oauthRefreshTokens.id, record.id));

  return issueTokenPair(record.clientId, record.userId);
}

/** Resolve an `Authorization: Bearer <access_token>` value issued by this
 * OAuth flow to the user it belongs to — same return shape as the plain
 * API-key path, so downstream code (session-middleware, route handlers)
 * doesn't need to know which auth method was used. */
export async function authenticateOAuthToken(rawToken: string): Promise<ApiKeyUser | null> {
  if (!rawToken.startsWith("mcp_at_")) return null;

  const tokenHash = sha256(rawToken);
  const record = await db.query.oauthAccessTokens.findFirst({
    where: and(eq(oauthAccessTokens.tokenHash, tokenHash), isNull(oauthAccessTokens.revokedAt)),
  });
  if (!record) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, record.userId),
    with: { assignedRole: true },
  });
  if (!user) return null;

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
