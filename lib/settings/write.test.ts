import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/settings/crypto";
import { planSettingsWrite } from "@/lib/settings/write";

const KEY = Buffer.alloc(32, 2);
const ADMIN = { role: "ADMIN" };
const MODERATOR = { role: "MODERATOR" };

describe("planSettingsWrite", () => {
  it("lets a settings:write user save ordinary settings", () => {
    const plan = planSettingsWrite({ site_name: "Nimbus Linen", footer_phone: "+8801700000000" }, MODERATOR, {}, KEY);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.rows).toEqual([
        { key: "site_name", value: "Nimbus Linen" },
        { key: "footer_phone", value: "+8801700000000" },
      ]);
    }
  });

  it("refuses a credential change from a non-admin", () => {
    expect(planSettingsWrite({ site_name: "A", bkash_password: "x" }, MODERATOR, {}, KEY)).toEqual({
      ok: false,
      status: 403,
      body: { error: "Only an admin can change these settings", keys: ["bkash_password"] },
    });
  });

  it("refuses AI settings from a non-admin", () => {
    const plan = planSettingsWrite({ ai_provider: "openai" }, MODERATOR, {}, KEY);
    expect(plan.ok === false && plan.status).toBe(403);
  });

  it("rejects keys the registry does not know", () => {
    expect(planSettingsWrite({ seo_magic: "1" }, ADMIN, {}, KEY)).toEqual({
      ok: false,
      status: 400,
      body: { error: "Unknown settings", keys: ["seo_magic"] },
    });
  });

  it("rejects an invalid value and names the key", () => {
    const plan = planSettingsWrite({ order_number_prefix: "ord-1" }, ADMIN, {}, KEY);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(Object.keys(plan.body.issues ?? {})).toEqual(["order_number_prefix"]);
  });

  it("encrypts a credential when the key is set", () => {
    const plan = planSettingsWrite({ bkash_password: "hunter2" }, ADMIN, {}, KEY);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.rows[0].value.startsWith("enc:v1:")).toBe(true);
      expect(decryptSecret(plan.rows[0].value, KEY, "bkash_password")).toBe("hunter2");
    }
  });

  it("stores a credential as plaintext when no key is set", () => {
    const plan = planSettingsWrite({ bkash_password: "hunter2" }, ADMIN, {}, null);
    expect(plan.ok && plan.rows[0].value).toBe("hunter2");
  });

  it("never puts a credential value in the change log", () => {
    const plan = planSettingsWrite({ bkash_password: "hunter2" }, ADMIN, { bkash_password: "old-secret" }, KEY);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.changes).toEqual([{ label: "Bkash Password", from: "(set)", to: "(updated)" }]);
      expect(JSON.stringify(plan.changes)).not.toMatch(/hunter2|old-secret/);
    }
  });

  it("skips values that did not change, including a re-sent credential", () => {
    const before = { site_name: "A", bkash_password: encryptSecret("hunter2", KEY, "bkash_password") };
    const plan = planSettingsWrite({ site_name: "A", bkash_password: "hunter2" }, ADMIN, before, KEY);
    expect(plan.ok && plan.rows).toEqual([]);
  });

  it("writes an empty value when there was no row, so clearing a default sticks", () => {
    const plan = planSettingsWrite({ social_instagram: "" }, MODERATOR, {}, KEY);
    expect(plan.ok && plan.rows).toEqual([{ key: "social_instagram", value: "" }]);
  });

  it("stores numbers and flags as their text", () => {
    const plan = planSettingsWrite({ shipping_inside_dhaka: 80, payment_method_cod: "false" }, MODERATOR, {}, KEY);
    expect(plan.ok && plan.rows).toEqual([
      { key: "shipping_inside_dhaka", value: "80" },
      { key: "payment_method_cod", value: "false" },
    ]);
  });

  it("lists the groups that changed", () => {
    const plan = planSettingsWrite({ site_name: "A", low_stock_threshold: "5" }, MODERATOR, {}, KEY);
    expect(plan.ok && plan.groups.sort()).toEqual(["business", "store"]);
  });
});
