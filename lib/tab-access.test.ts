import { describe, expect, it } from "vitest";
import { NAV_MENUS, NAV_TABS, menuTabs } from "@/lib/dashboard-nav";
import { sectionTabs } from "@/lib/dashboard-sections";
import { holdsAll, isKnownPermission, landingPath } from "@/lib/permissions";
import { canAccessNavId, canAccessSubTab, canAccessTab, firstAccessibleTab } from "@/lib/tab-access";
import { buildItems } from "@/components/app-sidebar";

type User = Parameters<typeof canAccessTab>[0];

const staff = (...permissions: string[]): User => ({ role: "STAFF", permissions });

// Products module, but only the Categories tab.
const categoriesOnly = staff("products:read", "tab:catalog.categories");

describe("dashboard nav", () => {
  it("has unique tab ids and hrefs", () => {
    expect(new Set(NAV_TABS.map((tab) => tab.id)).size).toBe(NAV_TABS.length);
    expect(new Set(NAV_TABS.map((tab) => tab.href)).size).toBe(NAV_TABS.length);
  });

  it("every menu has at least one tab", () => {
    for (const menu of NAV_MENUS) expect(menuTabs(menu).length, menu.key).toBeGreaterThan(0);
  });
});

describe("canAccessTab", () => {
  it("opens every tab for ADMIN and none for a guest", () => {
    for (const tab of NAV_TABS) {
      expect(canAccessTab({ role: "ADMIN", permissions: [] }, tab)).toBe(true);
      expect(canAccessTab(null, tab)).toBe(false);
    }
  });

  it("a role without tab grants opens every tab of its readable modules", () => {
    const user = staff("products:read");
    expect(canAccessTab(user, "catalog.products")).toBe(true);
    expect(canAccessTab(user, "catalog.categories")).toBe(true);
    expect(canAccessTab(user, "catalog.automation")).toBe(true);
    expect(canAccessTab(user, "catalog.blog")).toBe(false);
  });

  it("legacy flat permissions keep their tabs", () => {
    const user = staff("manage_settings");
    expect(canAccessTab(user, "settings.payments")).toBe(true);
    expect(canAccessTab(user, "reports.analytics")).toBe(true);
  });

  it("with tab grants, only the granted tabs open", () => {
    expect(canAccessTab(categoriesOnly, "catalog.categories")).toBe(true);
    expect(canAccessTab(categoriesOnly, "catalog.products")).toBe(false);
    expect(canAccessTab(categoriesOnly, "catalog.automation")).toBe(false);
  });

  it("a tab grant without its module's read opens nothing", () => {
    expect(canAccessTab(staff("tab:catalog.categories"), "catalog.categories")).toBe(false);
  });

  it("an unknown tab id is never open", () => {
    expect(canAccessTab(staff("products:read"), "catalog.nope")).toBe(false);
  });

  it("firstAccessibleTab follows navigation order", () => {
    expect(firstAccessibleTab(categoriesOnly)?.id).toBe("catalog.categories");
    expect(firstAccessibleTab(staff())).toBeUndefined();
  });
});

describe("canAccessSubTab", () => {
  const pendingOnly = staff("orders:read", "tab:sales.orders", "tab:sales.orders/PENDING");

  it("every in-page tab opens when the role grants none of them", () => {
    for (const user of [staff("orders:read"), staff("orders:read", "tab:sales.orders")]) {
      expect(canAccessSubTab(user, "sales.orders", "ALL")).toBe(true);
      expect(canAccessSubTab(user, "sales.orders", "PENDING")).toBe(true);
    }
  });

  it("with in-page grants, only those open", () => {
    expect(canAccessSubTab(pendingOnly, "sales.orders", "PENDING")).toBe(true);
    expect(canAccessSubTab(pendingOnly, "sales.orders", "ALL")).toBe(false);
    expect(canAccessNavId(pendingOnly, "sales.orders/PENDING")).toBe(true);
    expect(canAccessNavId(pendingOnly, "sales.orders/ALL")).toBe(false);
  });

  it("closes with its tab", () => {
    expect(canAccessSubTab(staff("orders:read", "tab:sales.pos"), "sales.orders", "PENDING")).toBe(false);
  });

  it("unknown keys never open", () => {
    expect(canAccessSubTab(staff("orders:read"), "sales.orders", "NOPE")).toBe(false);
  });

  it("can be granted only by someone who opens it", () => {
    expect(isKnownPermission("tab:sales.orders/PENDING")).toBe(true);
    expect(isKnownPermission("tab:sales.orders/NOPE")).toBe(false);
    const wanted = ["orders:read", "tab:sales.orders", "tab:sales.orders/ALL"];
    expect(holdsAll(pendingOnly, wanted)).toBe(false);
    expect(holdsAll(staff("orders:read"), wanted)).toBe(true);
  });
});

describe("section rail", () => {
  it("lists every tab and disables the ones the role doesn't open", () => {
    const tabs = sectionTabs("catalog", categoriesOnly);
    expect(tabs.map((tab) => tab.id)).toEqual(menuTabs(NAV_MENUS.find((m) => m.key === "catalog")!).map((t) => t.id));
    expect(tabs.filter((tab) => tab.allowed).map((tab) => tab.id)).toEqual(["catalog.categories"]);
  });
});

describe("sidebar", () => {
  it("shows a menu only when one of its tabs opens, and links to that tab", () => {
    const items = buildItems(categoriesOnly, "/dashboard/categories");
    expect(items.map((item) => [item.title, item.url])).toEqual([["Catalog", "/dashboard/categories"]]);
  });

  it("Settings links to the first settings page the role opens", () => {
    const items = buildItems(staff("settings:read", "tab:settings.seo"), "/dashboard");
    expect(items.map((item) => [item.title, item.url])).toEqual([["Settings", "/dashboard/settings/seo"]]);
  });
});

describe("landingPath", () => {
  it("lands on the module's first open tab", () => {
    expect(landingPath(categoriesOnly)).toBe("/dashboard/categories");
  });

  it("is unchanged for roles without tab grants", () => {
    expect(landingPath(staff("products:read"))).toBe("/dashboard/products");
    expect(landingPath(staff("users:read"))).toBe("/dashboard/users");
  });
});

describe("granting tabs", () => {
  it("tab permissions are known, made-up ones aren't", () => {
    expect(isKnownPermission("tab:settings.payments")).toBe(true);
    expect(isKnownPermission("tab:settings.nope")).toBe(false);
  });

  it("an actor without tab grants holds the tabs of their modules", () => {
    expect(holdsAll(staff("products:read"), ["products:read", "tab:catalog.categories"])).toBe(true);
  });

  it("an actor can't grant a tab they don't open", () => {
    expect(holdsAll(categoriesOnly, ["products:read", "tab:catalog.products"])).toBe(false);
  });

  it("a role without tab grants counts every tab it opens", () => {
    // Target opens all three catalog product tabs; actor only Categories.
    expect(holdsAll(categoriesOnly, ["products:read"])).toBe(false);
    expect(holdsAll(categoriesOnly, ["products:read", "tab:catalog.categories"])).toBe(true);
  });
});
