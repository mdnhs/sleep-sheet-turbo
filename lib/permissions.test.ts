import { describe, expect, it } from "vitest";
import { can, isAllowed, expandPermissions, landingPath, perm } from "@/lib/permissions";

describe("perm", () => {
  it("builds a module:action string", () => {
    expect(perm("products", "write")).toBe("products:write");
  });
});

describe("expandPermissions", () => {
  it("maps a legacy flat permission to its granular equivalent", () => {
    const granted = expandPermissions(["manage_products"]);
    expect(granted.has("products:write")).toBe(true);
  });

  it("makes write imply read on the same module", () => {
    const granted = expandPermissions(["orders:write"]);
    expect(granted.has("orders:read")).toBe(true);
  });

  it("makes write imply every extra action on the same module", () => {
    const granted = expandPermissions(["orders:write"]);
    expect(granted.has("orders:cancel")).toBe(true);
    expect(granted.has("orders:refund")).toBe(true);
    expect(granted.has("orders:delete")).toBe(true);
    expect(granted.has("orders:block_ip")).toBe(true);
    expect(granted.has("orders:balance")).toBe(true);
  });

  it("does not grant read-only permissions to write or extras", () => {
    const granted = expandPermissions(["orders:read"]);
    expect(granted.has("orders:write")).toBe(false);
    expect(granted.has("orders:cancel")).toBe(false);
  });

  it("returns an empty set for null/undefined input", () => {
    expect(expandPermissions(null).size).toBe(0);
    expect(expandPermissions(undefined).size).toBe(0);
  });
});

describe("can", () => {
  it("denies a null user", () => {
    expect(can(null, "orders", "read")).toBe(false);
  });

  it("grants ADMIN everything regardless of its permissions list", () => {
    expect(can({ role: "ADMIN", permissions: [] }, "roles", "write")).toBe(true);
  });

  it("checks the granular permission set for a non-admin role", () => {
    const user = { role: "USER", permissions: ["orders:read"] };
    expect(can(user, "orders", "read")).toBe(true);
    expect(can(user, "orders", "write")).toBe(false);
  });

  it("defaults the action to read", () => {
    const user = { role: "USER", permissions: ["orders:read"] };
    expect(can(user, "orders")).toBe(true);
  });
});

describe("isAllowed", () => {
  it("denies a null user even with a bypass role listed", () => {
    expect(isAllowed(null, "orders", "read", ["MODERATOR"])).toBe(false);
  });

  it("bypasses the permission check for a listed role", () => {
    const user = { role: "MODERATOR", permissions: [] };
    expect(isAllowed(user, "orders", "refund", ["MODERATOR"])).toBe(true);
  });

  it("does not bypass for a role not in the list", () => {
    const user = { role: "MODERATOR", permissions: [] };
    expect(isAllowed(user, "settings", "write", [])).toBe(false);
  });

  it("falls back to can() when no bypass role matches", () => {
    const user = { role: "USER", permissions: ["expenses:write"] };
    expect(isAllowed(user, "expenses", "write", ["MODERATOR"])).toBe(true);
    expect(isAllowed(user, "expenses", "write", [])).toBe(true);
  });

  it("still lets ADMIN through can()'s own bypass", () => {
    const user = { role: "ADMIN", permissions: [] };
    expect(isAllowed(user, "settings", "write", [])).toBe(true);
  });
});

describe("landingPath", () => {
  it("returns null for no user", () => {
    expect(landingPath(null)).toBeNull();
  });

  it("prefers an explicit custom landingUrl", () => {
    const user = { role: "USER", permissions: [], landingUrl: "/dashboard/orders" };
    expect(landingPath(user)).toBe("/dashboard/orders");
  });

  it("sends ADMIN to /dashboard/orders", () => {
    expect(landingPath({ role: "ADMIN", permissions: [] })).toBe("/dashboard/orders");
  });

  it("lands a granular role on its first readable module", () => {
    const user = { role: "USER", permissions: ["expenses:read"] };
    expect(landingPath(user)).toBe("/dashboard/expenses");
  });

  it("returns null when the user can read nothing", () => {
    expect(landingPath({ role: "USER", permissions: [] })).toBeNull();
  });
});
