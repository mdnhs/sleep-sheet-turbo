import { Hono } from "hono";
import { db } from "@/db";
import { users, orders, roles } from "@/db/schema";
import { eq, ne, or, and, desc, isNull, isNotNull, sql } from "drizzle-orm";
import { sessionMiddleware, invalidateSessionUser } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { can } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import { setActivityMeta } from "@/features/activity/server/log-activity";

const app = new Hono()
  .get("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!can(user, "users", "read")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Staff only: system role above USER, or a custom role assigned.
    // Plain USER accounts without a custom role are customers (see /customers).
    const allUsers = await db.query.users.findMany({
      where: or(ne(users.role, "USER"), isNotNull(users.roleId)),
      orderBy: (users, { desc }) => [desc(users.createdAt)],
      with: { assignedRole: true },
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        roleId: true,
        createdAt: true,
      }
    });

    return c.json(allUsers);
  })
  .get("/customers", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!can(user, "users", "read")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const customers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
        orderCount: sql<number>`COUNT(${orders.id}) FILTER (WHERE ${orders.status} != 'CANCELLED')`,
        totalSpent: sql<number>`COALESCE(SUM(${orders.totalAmount}) FILTER (WHERE ${orders.status} != 'CANCELLED'), 0)`,
        lastOrderAt: sql<string | null>`MAX(${orders.createdAt}) FILTER (WHERE ${orders.status} != 'CANCELLED')`,
      })
      .from(users)
      .leftJoin(orders, eq(orders.userId, users.id))
      .where(and(eq(users.role, "USER"), isNull(users.roleId)))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt));

    return c.json(customers.map((cust) => ({
      ...cust,
      orderCount: Number(cust.orderCount || 0),
      totalSpent: Number(cust.totalSpent || 0),
    })));
  })
  .post(
    "/",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        roleId: z.string().nullable().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!can(user, "users", "write")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { name, email, password, roleId } = c.req.valid("json");

      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser) {
        return c.json({ error: "Email already in use" }, 400);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [newUser] = await db.insert(users).values({
        name,
        email,
        password: hashedPassword,
        roleId: roleId || null,
        role: "USER", // Default system role
      }).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        roleId: users.roleId,
      });

      setActivityMeta(c, { name: newUser.name });

      return c.json(newUser);
    }
  )
  .patch(
    "/:id/role",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        roleId: z.string().nullable(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!can(user, "users", "write")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const id = c.req.param("id");
      const { roleId } = c.req.valid("json");

      // Cannot change superadmin
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, id),
      });

      if (!targetUser) {
        return c.json({ error: "User not found" }, 404);
      }
      
      if (targetUser.email === process.env.SUPER_ADMIN_EMAIL) {
        return c.json({ error: "Cannot change role of super admin" }, 400);
      }

      const [oldRole, newRole] = await Promise.all([
        targetUser.roleId
          ? db.query.roles.findFirst({ where: eq(roles.id, targetUser.roleId), columns: { name: true } })
          : null,
        roleId
          ? db.query.roles.findFirst({ where: eq(roles.id, roleId), columns: { name: true } })
          : null,
      ]);

      const [updated] = await db.update(users).set({
        roleId,
      }).where(eq(users.id, id)).returning({ id: users.id });

      // The session cache holds this user's permissions; drop it so the new
      // role applies on their very next request instead of after the TTL.
      invalidateSessionUser(id);

      setActivityMeta(c, {
        name: targetUser.name || targetUser.email,
        changes: [{ label: "Role", from: oldRole?.name ?? "None", to: newRole?.name ?? "None" }],
      });

      return c.json(updated);
    }
  )
  // Admin-side password reset — the only self-service path (OTP-based
  // forgot-password) was removed, so a user locked out or who forgot their
  // password now needs a staff member with MANAGE_USERS to set a new one.
  .patch(
    "/:id/password",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        newPassword: z.string().min(6),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!can(user, "users", "write")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const id = c.req.param("id");
      const { newPassword } = c.req.valid("json");

      const targetUser = await db.query.users.findFirst({ where: eq(users.id, id) });

      if (!targetUser) {
        return c.json({ error: "User not found" }, 404);
      }

      if (targetUser.email === process.env.SUPER_ADMIN_EMAIL) {
        return c.json({ error: "Cannot reset password of super admin" }, 400);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // A fresh password is also a legitimate reason to lift any lockout —
      // otherwise a locked-out user with a brand new password would still
      // have to wait out the timer.
      await db.update(users)
        .set({ password: hashedPassword, failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(users.id, id));

      setActivityMeta(c, {
        name: targetUser.name || targetUser.email,
        changes: [{ label: "Password", to: "Reset by admin" }],
      });

      return c.json({ success: true });
    }
  );

export default app;
