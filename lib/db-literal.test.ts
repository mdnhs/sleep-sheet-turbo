import { describe, expect, it } from "vitest";
import { pgStringLiteral } from "@/lib/db-literal";

describe("pgStringLiteral", () => {
  it("quotes a value", () => {
    expect(pgStringLiteral("Nimbus Linen (POS)")).toBe("'Nimbus Linen (POS)'");
  });

  it("doubles single quotes so a store name cannot break out of the literal", () => {
    expect(pgStringLiteral("Rahim's Store'); drop table orders; --")).toBe("'Rahim''s Store''); drop table orders; --'");
  });
});
