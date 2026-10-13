import { describe, expect, it } from "vitest";
import { settingsNav } from "@/app/(dashboard)/dashboard/settings/settings-nav";
import { dashboardSections, accessibleTabs, type SectionKey } from "@/lib/dashboard-sections";
import { MODULES, can, type ModuleKey } from "@/lib/permissions";
import { buildItems } from "./app-sidebar";

// Every page the flat sidebar used to link to, with the module that gated it.
const OLD_SIDEBAR: { url: string; module: ModuleKey }[] = [
  { url: "/dashboard", module: "dashboard" },
  { url: "/dashboard/reports", module: "reports" },
  { url: "/dashboard/analytics", module: "reports" },
  { url: "/dashboard/orders", module: "orders" },
  { url: "/dashboard/fraud-checker", module: "orders" },
  { url: "/dashboard/pos", module: "pos" },
  { url: "/dashboard/expenses", module: "expenses" },
  { url: "/dashboard/products", module: "products" },
  { url: "/dashboard/categories", module: "products" },
  { url: "/dashboard/images", module: "products" },
  { url: "/dashboard/blog", module: "blog" },
  { url: "/dashboard/testimonials", module: "testimonials" },
  { url: "/dashboard/customers", module: "users" },
  { url: "/dashboard/users", module: "users" },
  { url: "/dashboard/settings/roles", module: "roles" },
  { url: "/dashboard/activity", module: "activity" },
  { url: "/dashboard/settings", module: "settings" },
  // Added after the sections refactor.
  { url: "/dashboard/promotions", module: "promotions" },
  { url: "/dashboard/media", module: "products" },
];

const SECTIONS = Object.keys(dashboardSections) as SectionKey[];

type User = Parameters<typeof can>[0];

/** Every URL the new sidebar reaches: its entries plus the tabs inside each section and Settings. */
function reachable(user: User): Set<string> {
  const urls = new Set(buildItems(user, "/dashboard").map((item) => item.url));
  for (const key of SECTIONS) {
    if (urls.has(accessibleTabs(key, user)[0]?.href)) for (const tab of accessibleTabs(key, user)) urls.add(tab.href);
  }
  if ([...urls].some((url) => url.startsWith("/dashboard/settings"))) {
    for (const item of settingsNav.flatMap((group) => group.items)) {
      if (can(user, item.module, "read")) urls.add(item.href);
    }
    if (can(user, "settings", "read")) urls.add("/dashboard/settings");
  }
  return urls;
}

const users: [string, User][] = [
  ["ADMIN", { role: "ADMIN", permissions: [] }],
  ["no permissions", { role: "STAFF", permissions: [] }],
  ...MODULES.map((m): [string, User] => [`only ${m.key}:read`, { role: "STAFF", permissions: [`${m.key}:read`] }]),
];

describe("sidebar sections keep the old permission gates", () => {
  it.each(users)("%s reaches every page the old sidebar showed them", (_, user) => {
    const urls = reachable(user);
    for (const page of OLD_SIDEBAR) {
      if (can(user, page.module, "read")) expect(urls, page.url).toContain(page.url);
    }
  });

  it.each(users)("%s sees no entry or tab they can't read", (_, user) => {
    for (const item of buildItems(user, "/dashboard")) {
      const old = OLD_SIDEBAR.find((page) => page.url === item.url);
      const settingsPage = settingsNav.flatMap((group) => group.items).find((page) => page.href === item.url);
      const gate = old?.module ?? settingsPage?.module;
      expect(gate, item.url).toBeDefined();
      expect(can(user, gate!, "read"), item.url).toBe(true);
    }
    for (const key of SECTIONS) {
      for (const tab of accessibleTabs(key, user)) expect(can(user, tab.module, "read"), tab.href).toBe(true);
    }
  });

  it("a user with nothing readable gets an empty sidebar", () => {
    expect(buildItems({ role: "STAFF", permissions: [] }, "/dashboard")).toEqual([]);
  });

  it("highlights the section of the current page", () => {
    const admin: User = { role: "ADMIN", permissions: [] };
    const active = buildItems(admin, "/dashboard/pos").filter((item) => item.isActive);
    expect(active.map((item) => item.title)).toEqual(["Sales"]);
  });
});
