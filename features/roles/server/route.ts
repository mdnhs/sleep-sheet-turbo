import { Hono } from "hono";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { sessionMiddleware, invalidateAllSessions } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { can, holdsAll, isKnownPermission } from "@/lib/permissions";
import { setActivityMeta, type ActivityChange } from "@/features/activity/server/log-activity";

// A role editor may only grant what they hold, and only real permissions.
// An unknown string is either a typo or an attempt to sneak access past the
// role editor UI.
function grantProblem(user: Parameters<typeof holdsAll>[0], permissions: string[]) {
  const unknown = permissions.filter((p) => !isKnownPermission(p));
  if (unknown.length > 0) {
    return { status: 400 as const, body: { error: "Unknown permissions", permissions: unknown } };
  }
  if (!holdsAll(user, permissions)) {
    return { status: 403 as const, body: { error: "You can't grant permissions you don't have" } };
  }
  return null;
}

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

      const problem = grantProblem(user, permissions);
      if (problem) return c.json(problem.body, problem.status);

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

      const problem = grantProblem(user, permissions);
      if (problem) return c.json(problem.body, problem.status);

      const before = await db.query.roles.findFirst({ where: eq(roles.id, id) });
      if (!before) {
        return c.json({ error: "Role not found" }, 404);
      }
      if (!holdsAll(user, before.permissions)) {
        return c.json({ error: "You can't edit a role with more access than you" }, 403);
      }

      const existing = await db.query.roles.findFirst({
        where: eq(roles.name, name),
      });

      if (existing && existing.id !== id) {
        return c.json({ error: "Role name already exists" }, 400);
      }

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

      const role = await db.query.roles.findFirst({ where: eq(roles.id, id) });
      if (!role) {
        return c.json({ error: "Role not found" }, 404);
      }
      if (!holdsAll(user, role.permissions)) {
        return c.json({ error: "You can't delete a role with more access than you" }, 403);
      }

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
