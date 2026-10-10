import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/client-ip";

const headers = (h: Record<string, string>) => (name: string) => h[name];

describe("getClientIp", () => {
  it("prefers Cloudflare's header over a forged X-Forwarded-For", () => {
    expect(
      getClientIp(headers({ "cf-connecting-ip": "103.1.2.3", "x-forwarded-for": "6.6.6.6, 103.1.2.3" }))
    ).toBe("103.1.2.3");
  });

  it("falls back to X-Real-IP", () => {
    expect(getClientIp(headers({ "x-real-ip": "10.0.0.5" }))).toBe("10.0.0.5");
  });

  it("uses the rightmost X-Forwarded-For hop, not the client-supplied leftmost one", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "6.6.6.6, 172.70.1.1" }))).toBe("172.70.1.1");
  });

  it("trims whitespace", () => {
    expect(getClientIp(headers({ "cf-connecting-ip": "  103.1.2.3 " }))).toBe("103.1.2.3");
  });

  it("returns null when no header is present", () => {
    expect(getClientIp(headers({}))).toBeNull();
  });
});
