import { describe, expect, it } from "vitest";
import { AUTH_COOKIE, LEGACY_AUTH_COOKIE, readSessionCookie } from "@/features/auth/constants";

const jar = (cookies: Record<string, string>) => (name: string) => cookies[name];

describe("session cookie", () => {
  it("has a name that doesn't carry another store's brand", () => {
    expect(AUTH_COOKIE).toBe("store_session");
    expect(AUTH_COOKIE).not.toMatch(/lux/i);
  });

  it("reads the new cookie", () => {
    expect(readSessionCookie(jar({ [AUTH_COOKIE]: "new" }))).toEqual({ token: "new", legacy: false });
  });

  it("falls back to the old cookie name, so the rename logs nobody out", () => {
    expect(readSessionCookie(jar({ [LEGACY_AUTH_COOKIE]: "old" }))).toEqual({ token: "old", legacy: true });
  });

  it("prefers the new cookie when both are present", () => {
    expect(readSessionCookie(jar({ [AUTH_COOKIE]: "new", [LEGACY_AUTH_COOKIE]: "old" }))?.token).toBe("new");
  });

  it("returns null without a session", () => {
    expect(readSessionCookie(jar({}))).toBeNull();
  });
});
