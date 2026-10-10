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
