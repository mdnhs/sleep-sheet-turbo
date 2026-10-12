// RBAC: granular read/write permissions per module.
//
// A permission string has the shape `${module}:${action}` — e.g.
// "products:read", "products:write". `write` implies `read`.
//
// Legacy roles stored the old flat strings ("manage_products", …). Those are
// still honoured: `expandPermissions` maps every legacy string to its granular
// equivalent, so existing roles keep their access with no data migration.

import { NAV_IDS, NAV_TABS, allowedTabIds, isTabPerm, tabAllowed, tabPerm } from "@/lib/dashboard-nav";

// On top of modules, a role grants dashboard tabs (`tab:<id>`): which menus and
// tabs it opens. See lib/dashboard-nav.ts and lib/tab-access.ts.

export type Action = "read" | "write";

// Extra fine-grained actions beyond read/write, shown as their own toggles in
// the role editor. `write` on the same module implies all of them.
export type ExtraAction = { key: string; label: string };

export type ModuleDef = {
  key: string;
  label: string;
  description: string;
  actions: Action[];
  extras?: ExtraAction[];
};

// Ordered for display in the role editor.
export const MODULES = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Overview & summary",
    actions: ["read"],
  },
  {
    key: "products",
    label: "Products",
    description: "Catalog products & categories",
    actions: ["read", "write"],
  },
  {
    key: "orders",
    label: "Orders",
    description: "Customer orders & courier",
    actions: ["read", "write"],
    extras: [
      { key: "cancel", label: "Cancel" },
      { key: "refund", label: "Refund / amounts" },
      { key: "delete", label: "Delete" },
      { key: "block_ip", label: "Block customer IP" },
      { key: "balance", label: "Courier balance" },
    ],
  },
  {
    key: "pos",
    label: "Point of Sale",
    description: "In-store sales terminal",
    actions: ["read", "write"],
  },
  {
    key: "reports",
    label: "Reports",
    description: "Sales & analytics reports",
    actions: ["read"],
  },
  {
    key: "expenses",
    label: "Expenses",
    description: "Expense tracking",
    actions: ["read", "write"],
  },
  {
    key: "blog",
    label: "Blog",
    description: "Blog posts & content",
    actions: ["read", "write"],
  },
  {
    key: "testimonials",
    label: "Testimonials",
    description: "Customer testimonials",
    actions: ["read", "write"],
  },
  {
    key: "promotions",
    label: "Promotions",
    description: "Offers such as free delivery",
    actions: ["read", "write"],
  },
  {
    key: "users",
    label: "Staff & Customers",
    description: "User accounts & customers",
    actions: ["read", "write"],
  },
  {
    key: "settings",
    label: "Settings",
    description: "Store configuration & secrets",
    actions: ["read", "write"],
  },
  {
    key: "roles",
    label: "Roles & Permissions",
    description: "Custom roles & access",
    actions: ["read", "write"],
  },
  {
    key: "activity",
    label: "Activity Logs",
    description: "Audit trail",
    actions: ["read"],
  },
] as const satisfies readonly ModuleDef[];

export type ModuleKey = (typeof MODULES)[number]["key"];

/** Build a permission string, e.g. perm("products", "write") -> "products:write". */
export function perm(module: ModuleKey, action: Action): string {
  return `${module}:${action}`;
}

// Legacy flat permission -> granular permission(s) granted. First entry is the
// "primary" grant used when a legacy string is passed to hasPermission().
const LEGACY_MAP: Record<string, string[]> = {
  manage_products: ["products:write"],
  manage_blog: ["blog:write"],
  manage_orders: ["orders:write"],
  pos_access: ["pos:write"],
  manage_settings: ["settings:write", "reports:read", "expenses:write"],
  manage_users: ["users:write"],
  manage_roles: ["roles:write"],
  view_activity_logs: ["activity:read"],
};

// Kept so any lingering `PERMISSIONS.X` import still compiles. Prefer `can()`.
export const PERMISSIONS = {
  MANAGE_PRODUCTS: "manage_products",
  MANAGE_BLOG: "manage_blog",
  MANAGE_ORDERS: "manage_orders",
  POS_ACCESS: "pos_access",
  MANAGE_SETTINGS: "manage_settings",
  MANAGE_USERS: "manage_users",
  MANAGE_ROLES: "manage_roles",
  VIEW_ACTIVITY_LOGS: "view_activity_logs",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

type AuthUser = { role?: string; permissions?: string[]; landingUrl?: string | null } | null;

/**
 * Normalize stored permissions into a flat set of granular perms.
 * - legacy flat strings are expanded via LEGACY_MAP
 * - `${module}:write` implies `${module}:read`
 */
// Per-module extra actions that a `:write` grant automatically includes.
const WRITE_IMPLIES: Record<string, string[]> = Object.fromEntries(
  (MODULES as readonly ModuleDef[])
    .filter((m) => m.extras?.length)
    .map((m) => [m.key, m.extras!.map((e) => `${m.key}:${e.key}`)])
);

export function expandPermissions(raw?: string[] | null): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;

  for (const p of raw) {
    const mapped = LEGACY_MAP[p];
    if (mapped) {
      for (const g of mapped) out.add(g);
    } else {
      out.add(p);
    }
  }

  // write implies read + every fine-grained extra on the same module
  for (const p of [...out]) {
    if (p.endsWith(":write")) {
      const moduleKey = p.slice(0, -":write".length);
      out.add(`${moduleKey}:read`);
      for (const extra of WRITE_IMPLIES[moduleKey] ?? []) out.add(extra);
    }
  }

  return out;
}

/**
 * Primary check: does the user have `action` access to `module`?
 * `action` is "read" | "write" or a module-specific extra (e.g. "cancel").
 */
export function can(
  user: AuthUser,
  module: ModuleKey,
  action: Action | (string & {}) = "read"
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return expandPermissions(user.permissions).has(`${module}:${action}`);
}

/**
 * `can()` plus an explicit list of roles that bypass the permission check
 * entirely for this call (most commonly `["MODERATOR"]` — MODERATOR is not a
 * blanket bypass like ADMIN, it's granted per-module by whichever route calls
 * this with it in `bypassRoles`). Centralizes the
 * `role !== "ADMIN" && role !== "MODERATOR" && !can(...)` check that used to
 * be copy-pasted at every guard — same authorization decision, one place to
 * read it.
 */
export function isAllowed(
  user: AuthUser,
  module: ModuleKey,
  action: Action | (string & {}) = "read",
  bypassRoles: readonly string[] = []
): boolean {
  if (!user) return false;
  if (user.role && bypassRoles.includes(user.role)) return true;
  return can(user, module, action);
}

/**
 * Backward-compatible check. Accepts either a legacy flat string
 * ("manage_products") or a granular string ("products:read").
 */
export function hasPermission(user: AuthUser, permission: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const granted = expandPermissions(user.permissions);

  const mapped = LEGACY_MAP[permission];
  if (mapped) return granted.has(mapped[0]);

  return granted.has(permission);
}

// Ordered module -> landing route. First module the user can read decides where
// their "Go to Dashboard" button (and post-login redirect) should point.
const MODULE_ROUTES: { module: ModuleKey; path: string }[] = [
  { module: "dashboard", path: "/dashboard" },
  { module: "orders", path: "/dashboard/orders" },
  { module: "pos", path: "/dashboard/pos" },
  { module: "products", path: "/dashboard/products" },
  { module: "reports", path: "/dashboard/reports" },
  { module: "expenses", path: "/dashboard/expenses" },
  { module: "blog", path: "/dashboard/blog" },
  { module: "testimonials", path: "/dashboard/testimonials" },
  { module: "promotions", path: "/dashboard/promotions" },
  { module: "users", path: "/dashboard/users" },
  { module: "settings", path: "/dashboard/settings" },
  { module: "roles", path: "/dashboard/settings/roles" },
  { module: "activity", path: "/dashboard/activity" },
];

/**
 * The first dashboard route a user is allowed to read. ADMIN/MODERATOR land on
 * /dashboard/orders; a granular role lands on its first accessible module.
 * Returns null when the user has no dashboard access at all.
 */
export function landingPath(user: AuthUser): string | null {
  if (!user) return null;
  // A role's explicit custom URL always wins.
  if (user.landingUrl && user.landingUrl.trim()) return user.landingUrl.trim();
  if (user.role === "ADMIN" || user.role === "MODERATOR") return "/dashboard/orders";
  // A role may open only some of a module's tabs: land on the module's route
  // when its tab is open, otherwise on the module's first open tab.
  const granted = expandPermissions(user.permissions);
  for (const route of MODULE_ROUTES) {
    const open = NAV_TABS.filter((tab) => tab.module === route.module && tabAllowed(granted, tab));
    if (open.length === 0) continue;
    return (open.find((tab) => tab.href === route.path) ?? open[0]).href;
  }
  return null;
}

/** Every granular permission string the role editor can grant. */
export const ALL_PERMISSIONS: ReadonlySet<string> = new Set([
  ...(MODULES as readonly ModuleDef[]).flatMap((m) => [
    ...m.actions.map((a) => `${m.key}:${a}`),
    ...(m.extras ?? []).map((e) => `${m.key}:${e.key}`),
  ]),
  ...NAV_IDS.map(tabPerm),
]);

/** A granular permission from MODULES, or a legacy flat string that is still honoured. */
export function isKnownPermission(permission: string): boolean {
  return (
    ALL_PERMISSIONS.has(permission) ||
    Object.prototype.hasOwnProperty.call(LEGACY_MAP, permission)
  );
}

/**
 * Does `actor` hold every permission in `wanted`? Both sides are expanded
 * first, so legacy strings and write-implies-read/extras count. ADMIN holds
 * everything.
 *
 * Tabs are compared by what each side actually opens, not by the literal
 * `tab:*` strings: a role with no tab grants opens every tab of its readable
 * modules, so it holds (and grants) those tabs too.
 */
export function holdsAll(actor: AuthUser, wanted: readonly string[] | null | undefined): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  const mine = expandPermissions(actor.permissions);
  const theirs = expandPermissions(wanted ? [...wanted] : []);
  for (const p of theirs) {
    if (isTabPerm(p)) continue;
    if (!mine.has(p)) return false;
  }
  const myTabs = allowedTabIds(mine);
  for (const id of allowedTabIds(theirs)) {
    if (!myTabs.has(id)) return false;
  }
  return true;
}

/**
 * May `actor` change `target`'s role or password? Only an ADMIN may touch an
 * ADMIN, and anyone else only plain USER accounts whose permissions they
 * fully hold. A MODERATOR is refused outright: with no assigned role its
 * permissions are null, which reads as "holds nothing" here but means broad
 * access everywhere isAllowed(..., ["MODERATOR"]) is used. Otherwise users:write is a path to every other permission: reset a
 * stronger account's password, then sign in as it.
 */
export function canManageUser(
  actor: AuthUser,
  target: { role: string; permissions: readonly string[] | null | undefined }
): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  if (target.role !== "USER") return false;
  return holdsAll(actor, target.permissions);
}
