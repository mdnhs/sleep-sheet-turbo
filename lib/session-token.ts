import jwt from "jsonwebtoken";

/** What the login cookie's JWT carries. `tv` is User.tokenVersion at sign-in. */
export type SessionClaims = { id: string; email: string; tv?: number };

export function signSessionToken(user: { id: string; email: string; tokenVersion: number }): string {
  const claims: SessionClaims = { id: user.id, email: user.email, tv: user.tokenVersion };
  return jwt.sign(claims, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

/**
 * A token stays valid only while its version matches the user's current one,
 * so bumping User.tokenVersion (password reset or change) signs every existing
 * session out at once. Tokens from before this field existed carry no `tv`
 * and count as version 0 (the column default), so the deploy itself logs
 * nobody out.
 */
export function isTokenCurrent(
  claims: Pick<SessionClaims, "tv">,
  user: { tokenVersion: number }
): boolean {
  return (claims.tv ?? 0) === user.tokenVersion;
}
