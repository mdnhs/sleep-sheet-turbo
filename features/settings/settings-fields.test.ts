import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { SETTINGS, isSettingKey, type SettingKey } from "@/lib/settings/registry";
import {
  BUSINESS_RULE_SECTIONS,
  STORE_PROFILE_SECTIONS,
  blankRequiredKeys,
  changedSettings,
  toSettingsPatch,
} from "@/features/settings/settings-fields";

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

describe("required fields", () => {
  it("are exactly the ones the server cannot take as empty", () => {
    // "" parses for low_stock_threshold too, but z.coerce turns it into a silent 0.
    const mustBeRequired = (key: SettingKey) =>
      !(SETTINGS[key].schema as z.ZodType).safeParse("").success || key === "low_stock_threshold";
    for (const field of [...storeFields, ...businessFields]) {
      expect(Boolean(field.required), field.key).toBe(mustBeRequired(field.key));
    }
  });
});

describe("toSettingsPatch", () => {
  it("sends changed fields, trimmed", () => {
    expect(
      toSettingsPatch(
        [{ key: "store_city", label: "City" }, { key: "store_bin", label: "BIN" }],
        { store_city: "  Dhaka ", store_bin: "123" },
        { store_bin: "123" },
      ),
    ).toEqual({ store_city: "Dhaka" });
  });

  it("sends only the changed field when nothing is stored yet", () => {
    const fields = [...storeFields, ...businessFields];
    const values = Object.fromEntries(fields.map((f) => [f.key, ""]));
    expect(toSettingsPatch(fields, { ...values, store_city: "Chattogram" }, {})).toEqual({ store_city: "Chattogram" });
  });

  it("sends nothing when nothing changed, and a cleared stored field as blank", () => {
    const fields = [{ key: "store_city" as const, label: "City" }];
    expect(toSettingsPatch(fields, { store_city: "Dhaka " }, { store_city: "Dhaka" })).toEqual({});
    expect(toSettingsPatch(fields, { store_city: "" }, { store_city: "Dhaka" })).toEqual({ store_city: "" });
  });
});

describe("changedSettings", () => {
  const footerKeys = ["footer_phone", "footer_address", "social_facebook", "social_instagram"];

  it("from empty settings, sends only the one field that was changed", () => {
    const values = { footer_phone: "01700", footer_address: "", social_facebook: "", social_instagram: "" };
    expect(changedSettings(footerKeys, values, {})).toEqual({ footer_phone: "01700" });
  });

  it("never blanks a stored key the form did not touch, but does send an explicit clear", () => {
    const stored = { footer_phone: "01700", footer_address: "Road 2" };
    const values = { footer_phone: "01800", footer_address: "Road 2", social_facebook: "", social_instagram: "" };
    expect(changedSettings(footerKeys, values, stored)).toEqual({ footer_phone: "01800" });
    expect(changedSettings(footerKeys, { ...values, footer_address: "" }, stored)).toEqual({
      footer_phone: "01800",
      footer_address: "",
    });
  });
});

describe("blankRequiredKeys", () => {
  it("flags a cleared required field and not a cleared optional one", () => {
    const fields = [...storeFields, ...businessFields];
    expect(blankRequiredKeys(fields, { store_timezone: "", store_city: "", low_stock_threshold: "5" })).toEqual([
      "store_timezone",
    ]);
  });
});
