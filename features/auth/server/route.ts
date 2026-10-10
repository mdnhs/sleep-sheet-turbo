import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { LoginSchema, RegisterSchema } from "../schema";
import { deleteCookie, setCookie } from "hono/cookie";

import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { AUTH_COOKIE } from "../constants";
import { sessionMiddleware, invalidateSessionUser } from "@/lib/session-middleware";
import { rateLimit } from "@/lib/rate-limit";
import { signSessionToken } from "@/lib/session-token";
import { revokeUserCredentials, type RevokedCounts } from "@/lib/revoke-credentials";
import { z } from "zod";
import { getWishlistData } from "@/features/wishlist/server/get-wishlist-data";

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days, matches the JWT
} as const;

// Brute-force lockout: after this many wrong passwords in a row, the account
// is locked for LOCKOUT_MINUTES. Counter resets on any successful login.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const app = new Hono()
.get("/current",
    sessionMiddleware,
    // Bundles the wishlist in with the session-user check. Every storefront
    // page load fires both /api/auth/current and /api/wishlist back to back
    // (Navbar + CartProvider need the user, product cards/Navbar need the
    // wishlist) — folding the wishlist in here collapses that to one request.
    async (c) => {
      const user = c.get("user");
      if (user) {
        setCookie(c, "has_session", "1", {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
      } else {
        deleteCookie(c, "has_session", { path: "/" });
      }
      const wishlist = await getWishlistData(user?.id);

      return c.json({ data: user, wishlist });
    })
  .post("/register", rateLimit("register", 5, 15 * 60_000), zValidator("json", RegisterSchema), async (c) => {
    const { name, email, password } = c.req.valid("json");

    try {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser) {
        return c.json({ error: "User already exists" }, 409);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Never return the whole row: `.returning()` includes the bcrypt hash,
      // which then travels to the browser and through every proxy and log on
      // the way. Name the columns the client actually needs instead.
      const [user] = await db.insert(users).values({
        name,
        email,
        password: hashedPassword,
      }).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

      return c.json(user, 201);
    } catch (error) {
      console.error("Error during registration", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  })
  .post("/login", rateLimit("login", 10, 5 * 60_000), zValidator("json", LoginSchema), async (c) => {
    const { email, password } = c.req.valid("json");

    try {
      const user = await db.query.users.findFirst({ where: eq(users.email, email) });

      if (!user || !user.password) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        const remainingMin = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        return c.json(
          { error: `Too many failed attempts. Try again in ${remainingMin} minute${remainingMin === 1 ? "" : "s"}.` },
          423,
        );
      }

      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        const attempts = user.failedLoginAttempts + 1;
        const lockingOut = attempts >= MAX_FAILED_ATTEMPTS;

        await db.update(users)
          .set(
            lockingOut
              ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60000) }
              : { failedLoginAttempts: attempts },
          )
          .where(eq(users.id, user.id));

        if (lockingOut) {
          return c.json(
            { error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` },
            423,
          );
        }
        return c.json({ error: "Invalid credentials" }, 401);
      }

      // Successful login clears any prior failed-attempt count.
      if (user.failedLoginAttempts > 0 || user.lockedUntil) {
        await db.update(users)
          .set({ failedLoginAttempts: 0, lockedUntil: null })
          .where(eq(users.id, user.id));
      }

      const token = signSessionToken(user);
      setCookie(c, AUTH_COOKIE, token, SESSION_COOKIE_OPTIONS);

      // Lightweight non-httpOnly flag allowing client code to skip /api/auth/current
      // round-trips entirely when a visitor is an anonymous guest.
      setCookie(c, "has_session", "1", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      return c.json({
        message: "Logged in successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.email === process.env.SUPER_ADMIN_EMAIL ? "ADMIN" : user.role,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  })
  .post("/logout", sessionMiddleware, async (c) => {
    deleteCookie(c, AUTH_COOKIE, {
      path: "/",
    });
    deleteCookie(c, "has_session", {
      path: "/",
    });

    c.set("user", null);

    return c.json({ success: true, message: "Logged out successfully" });
  })

.patch(
  "/profile",
  sessionMiddleware,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(6).optional(),
    })
  ),
  async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const body = c.req.valid("json");

    const updateData: Partial<typeof users.$inferInsert> = {};
    if (body.name) updateData.name = body.name;
    if (body.address !== undefined) updateData.address = body.address;

    if (body.phone !== undefined) {
      const phone = body.phone.trim();
      // A phone number identifies exactly one customer — guest checkout and
      // POS both look accounts up by it (see lib/customers.ts), and it is
      // uniquely indexed. Claiming a number that already belongs to another
      // account would otherwise surface as an unexplained 500.
      if (phone) {
        const taken = await db.query.users.findFirst({ where: eq(users.phone, phone) });
        if (taken && taken.id !== user.id) {
          return c.json({ error: "That phone number is already in use" }, 409);
        }
      }
      updateData.phone = phone || null;
    }

    if (body.newPassword) {
      if (!body.currentPassword) {
        return c.json({ error: "Current password required" }, 400);
      }
      const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
      if (!dbUser) return c.json({ error: "User not found" }, 404);
      const valid = await bcrypt.compare(body.currentPassword, dbUser.password);
      if (!valid) return c.json({ error: "Current password is incorrect" }, 400);
      updateData.password = await bcrypt.hash(body.newPassword, 10);
    }

    // A new password also ends the API keys and MCP tokens the old one stood
    // behind. Same transaction as the password write: if the revoke fails the
    // password must not have changed either (fail closed).
    const { updated, revoked } = await db.transaction(async (tx) => {
      const [row] = await tx.update(users)
        .set({
          ...updateData,
          // A new password signs every other session out (lib/session-token.ts).
          ...(body.newPassword ? { tokenVersion: sql`${users.tokenVersion} + 1` } : {}),
        })
        .where(eq(users.id, user.id))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          address: users.address,
          role: users.role,
        });
      const counts: RevokedCounts | undefined = body.newPassword ? await revokeUserCredentials(tx, user.id) : undefined;
      return { updated: row, revoked: counts };
    });

    // Cached session copies name/phone/address, so drop it after an edit —
    // after the write, not before. Dropping it first left a window in which a
    // concurrent request could miss the cache, re-read the not-yet-updated
    // row, and re-cache the stale copy for another full TTL.
    invalidateSessionUser(user.id);

    if (body.newPassword) {
      // The version bump above signed this browser out too; give it a fresh cookie.
      const fresh = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { id: true, email: true, tokenVersion: true },
      });
      if (fresh) setCookie(c, AUTH_COOKIE, signSessionToken(fresh), SESSION_COOKIE_OPTIONS);
    }

    return c.json({ data: updated, ...(revoked ? { revoked } : {}) });
  }
)

export default app;
