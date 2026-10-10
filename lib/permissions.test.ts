import { describe, expect, it } from "vitest";
import { can, isAllowed, expandPermissions, landingPath, perm, holdsAll, isKnownPermission, canManageUser } from "@/lib/permissions";

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

describe("isKnownPermission", () => {
  it("accepts granular and legacy permissions", () => {
    expect(isKnownPermission("orders:write")).toBe(true);
    expect(isKnownPermission("orders:cancel")).toBe(true);
    expect(isKnownPermission("manage_orders")).toBe(true);
  });

  it("rejects strings no module defines", () => {
    expect(isKnownPermission("orders:view")).toBe(false);
    expect(isKnownPermission("superuser")).toBe(false);
    expect(isKnownPermission("toString")).toBe(false);
  });
});

describe("holdsAll", () => {
  const staff = { role: "USER", permissions: ["orders:write", "users:write"] };

  it("lets ADMIN grant anything", () => {
    expect(holdsAll({ role: "ADMIN" }, ["settings:write"])).toBe(true);
  });

  it("allows a subset of the actor's own permissions, after expansion", () => {
    expect(holdsAll(staff, ["orders:read", "orders:cancel"])).toBe(true);
    expect(holdsAll({ role: "USER", permissions: ["manage_orders"] }, ["orders:refund"])).toBe(true);
  });

  it("refuses anything the actor doesn't hold", () => {
    expect(holdsAll(staff, ["settings:write"])).toBe(false);
    expect(holdsAll(staff, ["orders:read", "roles:write"])).toBe(false);
  });

  it("refuses a signed-out actor", () => {
    expect(holdsAll(null, [])).toBe(false);
  });
});

describe("canManageUser", () => {
  const manager = { role: "USER", permissions: ["users:write", "orders:write"] };

  it("never lets a non-admin manage an ADMIN", () => {
    expect(canManageUser(manager, { role: "ADMIN", permissions: [] })).toBe(false);
  });

  it("refuses a target with permissions the actor lacks", () => {
    expect(canManageUser(manager, { role: "USER", permissions: ["settings:write"] })).toBe(false);
  });

  it("allows a target whose permissions the actor fully holds", () => {
    expect(canManageUser(manager, { role: "USER", permissions: ["orders:read"] })).toBe(true);
    expect(canManageUser(manager, { role: "USER", permissions: null })).toBe(true);
  });

  it("lets ADMIN manage anyone", () => {
    expect(canManageUser({ role: "ADMIN" }, { role: "ADMIN", permissions: [] })).toBe(true);
  });
});
