import { describe, expect, it } from "vitest";
import { publicSettingsMap } from "@/lib/settings/public";

describe("publicSettingsMap", () => {
  const map = publicSettingsMap([
    { key: "site_name", value: "Nimbus Linen" },
    { key: "bkash_password", value: "enc:v1:a.b.c" },
    { key: "steadfast_api_key", value: "" },
    { key: "ai_provider", value: "openai" },
    { key: "fraud_pathao_user", value: "orphan" },
    { key: "seo_magic", value: "1" },
  ]);

  it("serves public values as stored", () => {
    expect(map.site_name).toBe("Nimbus Linen");
  });

  it("replaces every credential with a configured flag", () => {
    expect(map.bkash_password).toBeUndefined();
    expect(map.bkash_password_set).toBe("true");
    expect(map.steadfast_api_key_set).toBe("false");
    expect(map.ai_api_key_set).toBe("false");
  });

  it("leaves out private and unregistered rows", () => {
    expect(map.ai_provider).toBeUndefined();
    expect(map.fraud_pathao_user).toBeUndefined();
    expect(map.seo_magic).toBeUndefined();
  });
});
