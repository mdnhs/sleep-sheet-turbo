import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { isTokenCurrent, signSessionToken } from "@/lib/session-token";

describe("isTokenCurrent", () => {
  it("accepts a token whose version matches", () => {
    expect(isTokenCurrent({ tv: 3 }, { tokenVersion: 3 })).toBe(true);
  });

  it("rejects a token from before the last bump", () => {
    expect(isTokenCurrent({ tv: 2 }, { tokenVersion: 3 })).toBe(false);
  });

  it("treats tokens issued before versioning as version 0", () => {
    expect(isTokenCurrent({}, { tokenVersion: 0 })).toBe(true);
    expect(isTokenCurrent({}, { tokenVersion: 1 })).toBe(false);
  });
});

describe("signSessionToken", () => {
  it("embeds the user's current token version", () => {
    process.env.JWT_SECRET = "test-secret-0123456789abcdef0123456789";
    const token = signSessionToken({ id: "u1", email: "a@b.c", tokenVersion: 4 });
    const claims = jwt.verify(token, process.env.JWT_SECRET) as { id: string; tv: number };
    expect(claims).toMatchObject({ id: "u1", tv: 4 });
  });
});
