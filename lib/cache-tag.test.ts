import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cacheTag } from "@/lib/cache-tag";

describe("cacheTag", () => {
  it("returns the bare root tag", () => {
    expect(cacheTag("settings")).toBe("settings");
  });

  it("scopes a tag with a colon", () => {
    expect(cacheTag("settings", "store")).toBe("settings:store");
  });

  it("keeps the tags that existing cache entries already carry", () => {
    expect(
      (["settings", "products", "categories", "blog", "testimonials"] as const).map((root) => cacheTag(root)),
    ).toEqual(["settings", "products", "categories", "blog", "testimonials"]);
  });
});

// SaaS-ready rule 4: tags come from cacheTag() only. features/web-analytics is
// owned by a parallel session and skipped here on purpose.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path.includes("node_modules") || path.startsWith(join("features", "web-analytics"))) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("cache tag literals", () => {
  it("are spelled only in lib/cache-tag.ts", () => {
    const offenders = ["app", "features", "lib"]
      .flatMap(sourceFiles)
      .filter((file) => /tags:\s*\[\s*["'`]|revalidateTag\(\s*["'`]/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
