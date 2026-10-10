import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env";

const base = { DATABASE_URL: "postgres://u:p@localhost:5432/db", JWT_SECRET: "x".repeat(32) };

describe("SETTINGS_ENCRYPTION_KEY", () => {
  it("is optional", () => {
    expect(envSchema.safeParse(base).success).toBe(true);
  });

  it("accepts 32 random bytes in base64", () => {
    const key = Buffer.alloc(32, 5).toString("base64");
    expect(envSchema.safeParse({ ...base, SETTINGS_ENCRYPTION_KEY: key }).success).toBe(true);
  });

  it("rejects a key of the wrong length, so a bad deploy fails at boot", () => {
    const key = Buffer.alloc(16, 5).toString("base64");
    expect(envSchema.safeParse({ ...base, SETTINGS_ENCRYPTION_KEY: key }).success).toBe(false);
  });
});
