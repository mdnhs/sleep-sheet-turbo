import { expandPermissions } from "@/lib/permissions";
import { NAV_TABS, NAV_TAB_BY_ID, subTabAllowed, tabAllowed, type NavTab } from "@/lib/dashboard-nav";

type AuthUser = { role?: string; permissions?: string[] } | null;

/**
 * May `user` open this dashboard tab? ADMIN opens everything. Accepts the tab
 * or its id (see lib/dashboard-nav.ts); an unknown id is never allowed.
 *
 * This gates navigation and pages. The tab's API is still guarded by its
 * module (`can(user, tab.module, ...)`).
 */
export function canAccessTab(user: AuthUser, tab: NavTab | string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const resolved = typeof tab === "string" ? NAV_TAB_BY_ID.get(tab) : tab;
  if (!resolved) return false;
  return tabAllowed(expandPermissions(user.permissions), resolved);
}

/** May `user` open in-page tab `key` of a dashboard tab? */
export function canAccessSubTab(user: AuthUser, tabId: string, key: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const tab = NAV_TAB_BY_ID.get(tabId);
  if (!tab?.subtabs?.some((sub) => sub.key === key)) return false;
  return subTabAllowed(expandPermissions(user.permissions), tab, key);
}

/** canAccessTab / canAccessSubTab by a nav id (`<tab id>` or `<tab id>/<key>`). */
export function canAccessNavId(user: AuthUser, id: string): boolean {
  const slash = id.indexOf("/");
  return slash < 0 ? canAccessTab(user, id) : canAccessSubTab(user, id.slice(0, slash), id.slice(slash + 1));
}

/** The first of `tabs` (navigation order by default) the user may open. */
export function firstAccessibleTab(user: AuthUser, tabs: readonly NavTab[] = NAV_TABS): NavTab | undefined {
  return tabs.find((tab) => canAccessTab(user, tab));
}
