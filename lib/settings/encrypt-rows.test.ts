import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/settings/crypto";
import { planEncryption } from "@/lib/settings/encrypt-rows";

const KEY = Buffer.alloc(32, 3);

describe("planEncryption", () => {
  it("encrypts plaintext credentials and nothing else", () => {
    const already = encryptSecret("done", KEY, "steadfast_api_key");
    const plan = planEncryption(
      [
        { key: "bkash_password", value: "hunter2" },
        { key: "steadfast_api_key", value: already },
        { key: "bkash_username", value: "" },
        { key: "site_name", value: "Nimbus Linen" },
        { key: "fraud_pathao_user", value: "orphan" },
      ],
      KEY,
    );
    expect(plan.map((row) => row.key)).toEqual(["bkash_password"]);
    expect(decryptSecret(plan[0].value, KEY, "bkash_password")).toBe("hunter2");
  });

  it("is a no-op the second time", () => {
    const once = planEncryption([{ key: "bkash_password", value: "hunter2" }], KEY);
    expect(planEncryption(once, KEY)).toEqual([]);
  });
});
