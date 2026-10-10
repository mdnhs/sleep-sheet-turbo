import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readSessionCookie } from "@/features/auth/constants";
import { isTokenCurrent, type SessionClaims } from "@/lib/session-token";

/** Server Component / Server Action equivalent of session-middleware's
 * cookie branch — Hono's `getCookie` only works inside a Hono request
 * context, so pages/actions outside `/api` (like /oauth/authorize) need
 * their own way to read who's logged in via `next/headers`. */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = readSessionCookie((name) => cookieStore.get(name)?.value)?.token;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as SessionClaims;
    const user = await db.query.users.findFirst({ where: eq(users.id, decoded.id) });
    if (!user || !isTokenCurrent(decoded, user)) return null;

    const isSuperAdmin = user.email === process.env.SUPER_ADMIN_EMAIL;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: isSuperAdmin ? "ADMIN" : user.role,
    };
  } catch {
    return null;
  }
}
