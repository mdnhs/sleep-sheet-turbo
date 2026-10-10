import { describe, expect, it } from "vitest";
import { settingsErrorMessage } from "@/features/settings/api/settings-error";

describe("settingsErrorMessage", () => {
  it("names each invalid field", () => {
    expect(
      settingsErrorMessage({ error: "Invalid settings", issues: { order_number_prefix: "2–6 capital letters or digits" } }),
    ).toBe("Invalid settings: order_number_prefix (2–6 capital letters or digits)");
  });

  it("names the refused keys", () => {
    expect(settingsErrorMessage({ error: "Only an admin can change these settings", keys: ["bkash_password"] })).toBe(
      "Only an admin can change these settings: bkash_password",
    );
  });

  it("falls back to a generic message", () => {
    expect(settingsErrorMessage(null)).toBe("Failed to save settings");
  });
});
