import type { ModuleKey } from "@/lib/permissions";

// The admin navigation as plain data: sidebar menu -> tabs, or for Settings
// menu -> groups -> tabs. A tab is a page; some pages have their own in-page
// tabs (sub-tabs). Roles grant tabs (`tab:<id>`) and sub-tabs
// (`tab:<id>/<key>`), see lib/permissions.ts. Icons are attached by the
// components that render it (lib/dashboard-sections.ts, settings-nav.ts).
//
// Pure data with a type-only import, so lib/permissions.ts can use it without
// an import cycle.

export interface NavTab {
  /** Stable id stored in roles as `tab:<id>` — don't rename. */
  id: string;
  title: string;
  href: string;
  /** Module whose `read` the tab also needs; its API is guarded by this module. */
  module: ModuleKey;
  /** In-page tabs. `key` is the page's own tab value — don't rename. */
  subtabs?: NavSubTab[];
}

export interface NavSubTab {
  key: string;
  title: string;
}

export interface NavGroup {
  key: string;
  title: string;
  tabs: NavTab[];
}

export interface NavMenu {
  key: string;
  title: string;
  /** Either tabs directly, or groups of tabs (Settings). */
  tabs?: NavTab[];
  groups?: NavGroup[];
}

export const NAV_MENUS: NavMenu[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    tabs: [
      {
        id: "dashboard",
        title: "Overview",
        href: "/dashboard",
        module: "dashboard",
        subtabs: [
          { key: "sales", title: "Sales Overview" },
          { key: "customers", title: "Customer Insights" },
        ],
      },
    ],
  },
  {
    key: "sales",
    title: "Sales",
    tabs: [
      {
        id: "sales.orders",
        title: "Orders",
        href: "/dashboard/orders",
        module: "orders",
        subtabs: [
          { key: "ALL", title: "All" },
          { key: "TODAY", title: "Today Confirmed" },
          { key: "PENDING", title: "Pending" },
          { key: "CONFIRMED", title: "Confirmed" },
          { key: "DELIVERED", title: "Delivered" },
          { key: "CANCELLED", title: "Cancelled" },
          { key: "RETURNED", title: "Returned" },
        ],
      },
      { id: "sales.pos", title: "POS", href: "/dashboard/pos", module: "pos" },
      {
        id: "sales.fraud-checker",
        title: "Fraud Checker",
        href: "/dashboard/fraud-checker",
        module: "orders",
        subtabs: [
          { key: "check", title: "Number Check" },
          { key: "plan", title: "My Plan" },
        ],
      },
    ],
  },
  {
    key: "catalog",
    title: "Catalog",
    tabs: [
      { id: "catalog.products", title: "Products", href: "/dashboard/products", module: "products" },
      { id: "catalog.categories", title: "Categories", href: "/dashboard/categories", module: "products" },
      { id: "catalog.automation", title: "Automation", href: "/dashboard/images", module: "products" },
      { id: "catalog.blog", title: "Blog", href: "/dashboard/blog", module: "blog" },
      { id: "catalog.testimonials", title: "Testimonials", href: "/dashboard/testimonials", module: "testimonials" },
    ],
  },
  {
    key: "promotions",
    title: "Promotions",
    tabs: [{ id: "promotions", title: "Promotions", href: "/dashboard/promotions", module: "promotions" }],
  },
  {
    key: "reports",
    title: "Reports",
    tabs: [
      { id: "reports.reports", title: "Reports", href: "/dashboard/reports", module: "reports" },
      {
        id: "reports.analytics",
        title: "Analytics",
        href: "/dashboard/analytics",
        module: "reports",
        subtabs: [
          { key: "funnel", title: "Funnel" },
          { key: "overview", title: "Overview" },
        ],
      },
      { id: "reports.expenses", title: "Expenses", href: "/dashboard/expenses", module: "expenses" },
    ],
  },
  {
    key: "people",
    title: "People",
    tabs: [
      { id: "people.customers", title: "Customers", href: "/dashboard/customers", module: "users" },
      { id: "people.staff", title: "Staff", href: "/dashboard/users", module: "users" },
      {
        id: "people.activity",
        title: "Activity Log",
        href: "/dashboard/activity",
        module: "activity",
        subtabs: [
          { key: "ALL", title: "Everything" },
          { key: "ERROR", title: "Failed" },
        ],
      },
    ],
  },
  {
    key: "settings",
    title: "Settings",
    groups: [
      {
        key: "store",
        title: "Store",
        tabs: [
          { id: "settings.store", title: "Store Profile", href: "/dashboard/settings/store", module: "settings" },
          { id: "settings.business", title: "Business Rules", href: "/dashboard/settings/business", module: "settings" },
          { id: "settings.pos", title: "POS", href: "/dashboard/settings/pos", module: "settings" },
          { id: "settings.currency", title: "Currency", href: "/dashboard/settings/currency", module: "settings" },
          { id: "settings.payments", title: "Payments", href: "/dashboard/settings/payments", module: "settings" },
          { id: "settings.shipping", title: "Shipping & Courier", href: "/dashboard/settings/shipping", module: "settings" },
        ],
      },
      {
        key: "marketing",
        title: "Marketing",
        tabs: [
          {
            id: "settings.seo",
            title: "SEO",
            href: "/dashboard/settings/seo",
            module: "settings",
            subtabs: [
              { key: "general", title: "General SEO" },
              { key: "analytics", title: "Analytics & Verification" },
              { key: "social", title: "Social & Branding" },
              { key: "crawlers", title: "AI Crawlers" },
            ],
          },
          { id: "settings.catalog", title: "Meta Catalog", href: "/dashboard/settings/catalog", module: "settings" },
          { id: "settings.social", title: "Social Manager", href: "/dashboard/settings/social", module: "settings" },
        ],
      },
      {
        key: "content",
        title: "Content",
        tabs: [
          {
            id: "settings.website",
            title: "Website",
            href: "/dashboard/settings/website",
            module: "settings",
            subtabs: [
              { key: "header", title: "Header" },
              { key: "hero", title: "Hero Slides" },
              { key: "promo", title: "Promo Banners" },
              { key: "features", title: "Features" },
              { key: "newsletter", title: "Newsletter" },
              { key: "footer", title: "Footer" },
            ],
          },
          { id: "settings.cdn", title: "CDN", href: "/dashboard/settings/cdn", module: "settings" },
        ],
      },
      {
        key: "access",
        title: "Access",
        tabs: [
          { id: "settings.roles", title: "Roles & Permissions", href: "/dashboard/settings/roles", module: "roles" },
          { id: "settings.api-keys", title: "API Keys", href: "/dashboard/settings/api-keys", module: "settings" },
        ],
      },
    ],
  },
];

/** Every tab of a menu, flattening Settings' groups. */
export function menuTabs(menu: NavMenu): NavTab[] {
  return menu.tabs ?? (menu.groups ?? []).flatMap((group) => group.tabs);
}

/** Every tab in navigation order. */
export const NAV_TABS: NavTab[] = NAV_MENUS.flatMap(menuTabs);

export const NAV_TAB_BY_ID: ReadonlyMap<string, NavTab> = new Map(NAV_TABS.map((tab) => [tab.id, tab]));

export function isTabActive(tab: Pick<NavTab, "href">, pathname: string): boolean {
  if (tab.href === "/dashboard") return pathname === "/dashboard";
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

/** The tab a dashboard URL belongs to (nested pages like /products/create count). */
export function tabForPath(pathname: string): NavTab | undefined {
  return NAV_TABS.find((tab) => isTabActive(tab, pathname));
}

// --- Tab grants -------------------------------------------------------------
//
// A role opens a tab when it has `read` on the tab's module AND either:
//   - grants no `tab:*` at all (roles saved before tab access existed: every
//     tab of a readable module stays open, so nothing changes for them), or
//   - grants `tab:<id>` for that tab.
// A sub-tab opens when its tab opens AND either the role grants no sub-tab of
// that tab (all open) or grants `tab:<id>/<key>`.
// Pure set logic so both lib/permissions.ts and lib/tab-access.ts can use it.

const TAB_PREFIX = "tab:";

export function tabPerm(id: string): string {
  return `${TAB_PREFIX}${id}`;
}

export function subTabId(tabId: string, key: string): string {
  return `${tabId}/${key}`;
}

/** A tab id or a `<tab id>/<key>` sub-tab id that exists in the nav. */
export function isNavId(id: string): boolean {
  if (NAV_TAB_BY_ID.has(id)) return true;
  const slash = id.indexOf("/");
  if (slash < 0) return false;
  const tab = NAV_TAB_BY_ID.get(id.slice(0, slash));
  const key = id.slice(slash + 1);
  return !!tab?.subtabs?.some((sub) => sub.key === key);
}

export function isTabPerm(permission: string): boolean {
  return permission.startsWith(TAB_PREFIX) && isNavId(permission.slice(TAB_PREFIX.length));
}

/**
 * The checkboxes of a tab in the role editor: its sub-tabs, or the tab
 * itself when it has none.
 */
export function leafIds(tab: NavTab): string[] {
  return tab.subtabs ? tab.subtabs.map((sub) => subTabId(tab.id, sub.key)) : [tab.id];
}

/** Every tab and sub-tab id a role can be granted. */
export const NAV_IDS: string[] = NAV_TABS.flatMap((tab) => [
  tab.id,
  ...(tab.subtabs ?? []).map((sub) => subTabId(tab.id, sub.key)),
]);

function grantsAny(granted: ReadonlySet<string>, prefix: string): boolean {
  for (const p of granted) if (p.startsWith(prefix)) return true;
  return false;
}

/** `granted` must already be expanded (lib/permissions.ts expandPermissions). */
export function tabAllowed(granted: ReadonlySet<string>, tab: NavTab): boolean {
  if (!granted.has(`${tab.module}:read`)) return false;
  return !grantsAny(granted, TAB_PREFIX) || granted.has(tabPerm(tab.id));
}

export function subTabAllowed(granted: ReadonlySet<string>, tab: NavTab, key: string): boolean {
  if (!tabAllowed(granted, tab)) return false;
  const prefix = `${tabPerm(tab.id)}/`;
  return !grantsAny(granted, prefix) || granted.has(`${prefix}${key}`);
}

/** Ids of every tab and sub-tab an expanded permission set opens. */
export function allowedTabIds(granted: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const tab of NAV_TABS) {
    if (!tabAllowed(granted, tab)) continue;
    out.add(tab.id);
    for (const sub of tab.subtabs ?? []) {
      if (subTabAllowed(granted, tab, sub.key)) out.add(subTabId(tab.id, sub.key));
    }
  }
  return out;
}
