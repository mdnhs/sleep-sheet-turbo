import { Hono } from "hono";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { sessionMiddleware, invalidateAllSessions } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { can } from "@/lib/permissions";
import { setActivityMeta, type ActivityChange } from "@/features/activity/server/log-activity";

const app = new Hono()
  .get("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!can(user, "roles", "read")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const allRoles = await db.query.roles.findMany({
      orderBy: (roles, { desc }) => [desc(roles.createdAt)],
    });

    return c.json(allRoles);
  })
  .post(
    "/",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        permissions: z.array(z.string()),
        landingUrl: z.string().optional().nullable(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!can(user, "roles", "write")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { name, permissions, landingUrl } = c.req.valid("json");

      const existing = await db.query.roles.findFirst({
        where: eq(roles.name, name),
      });

      if (existing) {
        return c.json({ error: "Role name already exists" }, 400);
      }

      const [newRole] = await db.insert(roles).values({
        name,
        permissions,
        landingUrl: landingUrl?.trim() || null,
      }).returning();

      setActivityMeta(c, { name: newRole.name });

      return c.json(newRole);
    }
  )
  .patch(
    "/:id",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        permissions: z.array(z.string()),
        landingUrl: z.string().optional().nullable(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      if (!can(user, "roles", "write")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const id = c.req.param("id");
      const { name, permissions, landingUrl } = c.req.valid("json");

      const existing = await db.query.roles.findFirst({
        where: eq(roles.name, name),
      });

      if (existing && existing.id !== id) {
        return c.json({ error: "Role name already exists" }, 400);
      }

      const before = await db.query.roles.findFirst({ where: eq(roles.id, id) });

      const [updated] = await db.update(roles).set({
        name,
        permissions,
        landingUrl: landingUrl?.trim() || null,
      }).where(eq(roles.id, id)).returning();

      if (!updated) {
        return c.json({ error: "Role not found" }, 404);
      }

      // Cached sessions carry the old permission list. Clearing the whole
      // cache is cheap (it refills from one query per active user) and avoids
      // having to look up who holds this role.
      invalidateAllSessions();

      if (before) {
        const changes: ActivityChange[] = [];
        if (before.name !== updated.name) {
          changes.push({ label: "Name", from: before.name, to: updated.name });
        }
        const beforePerms = new Set(before.permissions);
        const afterPerms = new Set(updated.permissions);
        if (beforePerms.size !== afterPerms.size || [...beforePerms].some((p) => !afterPerms.has(p))) {
          changes.push({ label: "Permissions", from: `${beforePerms.size} granted`, to: `${afterPerms.size} granted` });
        }
        setActivityMeta(c, { name: updated.name, changes });
      }

      return c.json(updated);
    }
  )
  .delete(
    "/:id",
    sessionMiddleware,
    async (c) => {
      const user = c.get("user");
      if (!can(user, "roles", "write")) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const id = c.req.param("id");

      // Check if role is in use
      const [usersWithRole] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.roleId, id));

      if (usersWithRole && usersWithRole.count > 0) {
        return c.json({ error: "Cannot delete role because it is assigned to users" }, 400);
      }

      const [deleted] = await db.delete(roles).where(eq(roles.id, id)).returning();

      if (!deleted) {
        return c.json({ error: "Role not found" }, 404);
      }

      setActivityMeta(c, { name: deleted.name });

      return c.json({ success: true });
    }
  );

export default app;
