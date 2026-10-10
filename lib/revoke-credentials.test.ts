import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { revokeUserCredentials } from "@/lib/revoke-credentials";

// Real Postgres (PGlite): the subset of each table the update touches.
let client: PGlite;
let db: ReturnType<typeof drizzle>;
const EARLIER = new Date("2026-01-01T00:00:00Z");
const NOW = new Date("2026-10-11T12:00:00Z");

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  for (const table of ["api_keys", "oauth_access_tokens", "oauth_refresh_tokens"]) {
    await db.execute(sql.raw(`create table ${table} (id text primary key, "userId" text not null, "revokedAt" timestamp(3))`));
  }
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  for (const table of ["api_keys", "oauth_access_tokens", "oauth_refresh_tokens"]) {
    await db.execute(sql.raw(`delete from ${table}`));
    await db.execute(
      sql.raw(`insert into ${table} (id, "userId", "revokedAt") values
        ('a', 'u1', null), ('b', 'u1', '${EARLIER.toISOString()}'), ('c', 'u2', null)`),
    );
  }
});

async function revokedAt(table: string, id: string) {
  const res = await db.execute<{ revokedAt: string | null }>(sql.raw(`select "revokedAt" from ${table} where id = '${id}'`));
  return res.rows[0]?.revokedAt ? new Date(res.rows[0].revokedAt + "Z").toISOString() : null;
}

describe("revokeUserCredentials", () => {
  it("revokes the user's live keys and tokens", async () => {
    const counts = await revokeUserCredentials(db as never, "u1", NOW);
    expect(counts).toEqual({ apiKeys: 1, oauthAccessTokens: 1, oauthRefreshTokens: 1 });
    for (const table of ["api_keys", "oauth_access_tokens", "oauth_refresh_tokens"]) {
      expect(await revokedAt(table, "a")).toBe(NOW.toISOString());
    }
  });

  it("keeps the original date on something already revoked", async () => {
    await revokeUserCredentials(db as never, "u1", NOW);
    expect(await revokedAt("api_keys", "b")).toBe(EARLIER.toISOString());
  });

  it("leaves other users alone", async () => {
    await revokeUserCredentials(db as never, "u1", NOW);
    expect(await revokedAt("api_keys", "c")).toBeNull();
    expect(await revokedAt("oauth_refresh_tokens", "c")).toBeNull();
  });
});
