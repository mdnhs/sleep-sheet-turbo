import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env";

const validBase = {
  DATABASE_URL: "postgresql://user:pass@host/db",
  JWT_SECRET: "a".repeat(32),
};

describe("envSchema", () => {
  it("accepts the minimal required set", () => {
    const result = envSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rejects a missing DATABASE_URL", () => {
    const { DATABASE_URL, ...rest } = validBase;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a JWT_SECRET shorter than 32 characters", () => {
    const result = envSchema.safeParse({ ...validBase, JWT_SECRET: "too-short" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed SUPER_ADMIN_EMAIL", () => {
    const result = envSchema.safeParse({ ...validBase, SUPER_ADMIN_EMAIL: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("defaults NODE_ENV to development when unset", () => {
    const result = envSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.NODE_ENV).toBe("development");
  });

  it("leaves optional feature vars undefined when unset", () => {
    const result = envSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.META_CAPI_ACCESS_TOKEN).toBeUndefined();
      expect(result.data.TRUSTED_ORIGINS).toBeUndefined();
    }
  });
});
