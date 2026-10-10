import { describe, expect, it } from "vitest";
import { translations } from "@/hooks/use-language";

describe("translations", () => {
  it("name the store only through the {store} placeholder", () => {
    const all = JSON.stringify(translations);
    expect(all).not.toMatch(/Sleep Sheet|স্লিপ শীট|স্লিপ শিটের/);
    expect(all).toContain("{store}");
  });
});
