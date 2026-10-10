import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { apiKeys } from "@/db/schema";

describe("api_keys table", () => {
  it("has no column that could hold a usable raw key", () => {
    expect(Object.keys(getTableColumns(apiKeys))).not.toContain("rawKey");
  });
});
