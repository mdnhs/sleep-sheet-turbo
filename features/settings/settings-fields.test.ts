import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { SETTINGS, isSettingKey } from "@/lib/settings/registry";
import { BUSINESS_RULE_SECTIONS, STORE_PROFILE_SECTIONS, toSettingsPatch } from "@/features/settings/settings-fields";

const storeFields = STORE_PROFILE_SECTIONS.flatMap((section) => section.fields);
const businessFields = BUSINESS_RULE_SECTIONS.flatMap((section) => section.fields);

describe("settings field lists", () => {
  it("only use registered keys", () => {
    expect([...storeFields, ...businessFields].filter((f) => !isSettingKey(f.key))).toEqual([]);
  });

  it("a settings:write user can save every store-profile and business-rules field", () => {
    for (const field of [...storeFields, ...businessFields]) {
      expect(SETTINGS[field.key].write, field.key).toBe("settings:write");
    }
  });

  it("put each field in its own group", () => {
    expect(storeFields.every((f) => SETTINGS[f.key].group === "store")).toBe(true);
    expect(businessFields.every((f) => SETTINGS[f.key].group === "business")).toBe(true);
  });

  it("offer only options the server accepts", () => {
    for (const field of [...storeFields, ...businessFields]) {
      for (const option of field.options ?? []) {
        expect((SETTINGS[field.key].schema as z.ZodType).safeParse(option.value).success, `${field.key}=${option.value}`).toBe(true);
      }
    }
  });
});

describe("toSettingsPatch", () => {
  it("sends every field, trimmed", () => {
    expect(
      toSettingsPatch(
        [{ key: "store_city", label: "City" }, { key: "store_bin", label: "BIN" }],
        { store_city: "  Dhaka ", store_bin: undefined as unknown as string },
      ),
    ).toEqual({ store_city: "Dhaka", store_bin: "" });
  });
});
