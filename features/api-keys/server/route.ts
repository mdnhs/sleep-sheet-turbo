import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { sessionMiddleware } from "@/lib/session-middleware";
import { generateRawApiKey, hashApiKey, displayPrefix } from "@/lib/api-keys";
import { setActivityMeta } from "@/features/activity/server/log-activity";

// ADMIN-only, not just MANAGE_SETTINGS — a key acts as a permanent,
// non-expiring login for whoever holds it, so issuing/revoking one is at
// least as sensitive as creating a staff account.
function requireAdmin(user: { role?: string } | null | undefined): boolean {
  return !!user && user.role === "ADMIN";
}

const app = new Hono()

  .get("/", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!requireAdmin(user)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.userId, users.id))
      .orderBy(desc(apiKeys.createdAt));

    return c.json(rows);
  })

  .post(
    "/",
    sessionMiddleware,
    zValidator("json", z.object({ name: z.string().trim().min(1).max(100) })),
    async (c) => {
      const user = c.get("user");
      if (!requireAdmin(user)) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { name } = c.req.valid("json");
      const rawKey = generateRawApiKey();

      const [created] = await db
        .insert(apiKeys)
        .values({
          name,
          keyHash: hashApiKey(rawKey),
          keyPrefix: displayPrefix(rawKey),
          userId: user!.id,
        })
        .returning({ id: apiKeys.id, name: apiKeys.name, createdAt: apiKeys.createdAt });

      setActivityMeta(c, { name });

      // The only time the raw key is ever readable — the server doesn't
      // keep it, only its hash. If this response is lost, the key is gone
      // and a new one must be issued.
      return c.json({ ...created, rawKey }, 201);
    }
  )

  .delete("/:id", sessionMiddleware, async (c) => {
    const user = c.get("user");
    if (!requireAdmin(user)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id");
    const existing = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id),
    });
    if (!existing) {
      return c.json({ error: "Key not found" }, 404);
    }
    if (existing.revokedAt) {
      return c.json({ success: true });
    }

    await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));

    setActivityMeta(c, { name: existing.name, changes: [{ label: "Status", to: "Revoked" }] });

    return c.json({ success: true });
  });

export default app;
