import { describe, it, expect } from "vitest";
import { can, isAllowed } from "./permissions";

// Mirrors canViewAnalytics in features/analytics/server/route.ts. Kept here
// because the route module pulls in the db client, and the decision under
// test is pure.
const canViewAnalytics = (user: Parameters<typeof can>[0]) =>
  isAllowed(user, "dashboard", "read", ["MODERATOR"]) || can(user, "reports", "read");

// The two roles that actually exist in this store, copied verbatim from the
// roles table. If either changes shape, this test should be the thing that
// notices — the guard was chosen to fit them.
const OWNER = [
  "products:write", "orders:write", "pos:write", "view_analytics",
  "settings:write", "reports:read", "expenses:write", "products:read",
  "orders:read", "orders:cancel", "orders:refund", "orders:delete",
  "orders:balance", "pos:read", "settings:read", "expenses:read",
  "testimonials:read", "testimonials:write",
];
const ORDER_PRINT = ["orders:read"];

describe("canViewAnalytics", () => {
  it("denies an anonymous caller", () => {
    expect(canViewAnalytics(null)).toBe(false);
  });

  // The whole reason for the guard: signup is public, and a customer account
  // is role USER with no permissions. 257 such accounts exist.
  it("denies an ordinary customer account", () => {
    expect(canViewAnalytics({ role: "USER", permissions: [] })).toBe(false);
  });

  it("allows ADMIN", () => {
    expect(canViewAnalytics({ role: "ADMIN", permissions: [] })).toBe(true);
  });

  it("allows MODERATOR", () => {
    expect(canViewAnalytics({ role: "MODERATOR", permissions: [] })).toBe(true);
  });

  // Owner carries reports:read but NOT dashboard:read. Gating on
  // dashboard:read alone would have locked the store's own operator out.
  it("allows the Owner role", () => {
    expect(canViewAnalytics({ role: "USER", permissions: OWNER })).toBe(true);
  });

  it("denies the Order Print role", () => {
    expect(canViewAnalytics({ role: "USER", permissions: ORDER_PRINT })).toBe(false);
  });

  it("allows a role granted dashboard:read directly", () => {
    expect(canViewAnalytics({ role: "USER", permissions: ["dashboard:read"] })).toBe(true);
  });

  it("does not let an unrelated write grant leak analytics access", () => {
    expect(canViewAnalytics({ role: "USER", permissions: ["testimonials:write"] })).toBe(false);
    expect(canViewAnalytics({ role: "USER", permissions: ["blog:write"] })).toBe(false);
  });

  // `manage_settings` is the legacy flat string, and LEGACY_MAP expands it to
  // include reports:read — so a role stored before granular permissions
  // existed keeps the access it had.
  it("honours the legacy manage_settings string", () => {
    expect(canViewAnalytics({ role: "USER", permissions: ["manage_settings"] })).toBe(true);
  });
});
