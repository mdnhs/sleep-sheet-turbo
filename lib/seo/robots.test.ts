import { describe, expect, it } from "vitest";
import { defaultRobotsTxt } from "@/lib/seo/robots";

describe("defaultRobotsTxt", () => {
  it("blocks AI training crawlers by default", () => {
    expect(defaultRobotsTxt()).toContain("User-agent: GPTBot");
  });

  it("allows them when the admin switches the block off", () => {
    expect(defaultRobotsTxt(false)).not.toContain("GPTBot");
    expect(defaultRobotsTxt(false)).toContain("Disallow: /dashboard/");
  });
});
