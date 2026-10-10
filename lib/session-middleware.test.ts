import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import jwt from "jsonwebtoken";

const findFirst = vi.fn();
vi.mock("@/db", () => ({ db: { query: { users: { findFirst: (...a: unknown[]) => findFirst(...a) } } } }));
vi.mock("@/lib/api-keys", () => ({ authenticateApiKey: vi.fn() }));
vi.mock("@/lib/oauth", () => ({ authenticateOAuthToken: vi.fn() }));

import { sessionMiddleware, invalidateAllSessions } from "@/lib/session-middleware";
import { AUTH_COOKIE, LEGACY_AUTH_COOKIE } from "@/features/auth/constants";

process.env.JWT_SECRET = "test-secret";

const app = new Hono().get("/me", sessionMiddleware, (c) => c.json({ user: c.get("user") }));
const row = (tokenVersion: number) => ({
  id: "u1", email: "a@b.c", name: "A", role: "ADMIN", phone: null, address: null,
  tokenVersion, assignedRole: null,
});
const tokenFor = (tv: number) => jwt.sign({ id: "u1", email: "a@b.c", tv }, process.env.JWT_SECRET!);
const get = (cookie: string) => app.request("/me", { headers: { cookie } });
const setCookies = (res: Response) => res.headers.getSetCookie();

describe("sessionMiddleware cookie rename", () => {
  beforeEach(() => {
    invalidateAllSessions();
    findFirst.mockReset();
  });

  it("accepts the legacy cookie and re-issues it under the new name", async () => {
    findFirst.mockResolvedValue(row(0));
    const t = tokenFor(0);
    const res = await get(`${LEGACY_AUTH_COOKIE}=${t}`);
    expect((await res.json()).user.id).toBe("u1");
    const sc = setCookies(res);
    expect(sc.some((c) => c.startsWith(`${AUTH_COOKIE}=${t}`))).toBe(true);
    expect(sc.some((c) => c.startsWith(`${LEGACY_AUTH_COOKIE}=;`))).toBe(true);
  });

  it("re-issues on a cache hit too", async () => {
    findFirst.mockResolvedValue(row(0));
    const t = tokenFor(0);
    await get(`${AUTH_COOKIE}=${t}`); // primes the cache
    const res = await get(`${LEGACY_AUTH_COOKIE}=${t}`);
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(setCookies(res).some((c) => c.startsWith(`${AUTH_COOKIE}=${t}`))).toBe(true);
  });

  it("does not touch cookies for a new-name session", async () => {
    findFirst.mockResolvedValue(row(0));
    const res = await get(`${AUTH_COOKIE}=${tokenFor(0)}`);
    expect(setCookies(res)).toEqual([]);
  });

  it("applies the tokenVersion check to a legacy-cookie session and clears both cookies", async () => {
    findFirst.mockResolvedValue(row(1));
    const res = await get(`${LEGACY_AUTH_COOKIE}=${tokenFor(0)}`);
    expect((await res.json()).user).toBeNull();
    const sc = setCookies(res);
    expect(sc.some((c) => c.startsWith(`${AUTH_COOKIE}=;`))).toBe(true);
    expect(sc.some((c) => c.startsWith(`${LEGACY_AUTH_COOKIE}=;`))).toBe(true);
    expect(sc.some((c) => c.startsWith(`${AUTH_COOKIE}=ey`))).toBe(false);
  });

  it("clears both cookies on an invalid token", async () => {
    const res = await get(`${LEGACY_AUTH_COOKIE}=garbage`);
    expect((await res.json()).user).toBeNull();
    const sc = setCookies(res);
    expect(sc.some((c) => c.startsWith(`${AUTH_COOKIE}=;`))).toBe(true);
    expect(sc.some((c) => c.startsWith(`${LEGACY_AUTH_COOKIE}=;`))).toBe(true);
  });
});
