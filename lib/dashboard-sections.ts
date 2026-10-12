import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Banknote,
  BarChart3,
  Calculator,
  FileText,
  FolderTree,
  LineChart,
  MessageSquareQuote,
  Package,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import { canAccessTab } from "@/lib/tab-access";
import { NAV_MENUS, isTabActive, menuTabs, type NavTab } from "@/lib/dashboard-nav";

export { isTabActive };

// The admin sidebar shows one entry per section; the pages inside a section
// are vertical tabs on the left of the page (components/section-shell.tsx).
// URLs are unchanged: each section is a route group under app/(dashboard)/dashboard.
// The tabs themselves are defined in lib/dashboard-nav.ts.

export type SectionKey = "sales" | "catalog" | "reports" | "people";

export interface SectionTab extends NavTab {
  icon: LucideIcon;
}

export interface Section {
  key: SectionKey;
  title: string;
  tabs: SectionTab[];
}

const TAB_ICONS: Record<string, LucideIcon> = {
  "sales.orders": ShoppingCart,
  "sales.pos": Calculator,
  "sales.fraud-checker": ShieldCheck,
  "catalog.products": Package,
  "catalog.categories": FolderTree,
  "catalog.automation": Workflow,
  "catalog.blog": FileText,
  "catalog.testimonials": MessageSquareQuote,
  "reports.reports": BarChart3,
  "reports.analytics": LineChart,
  "reports.expenses": Banknote,
  "people.customers": UserRound,
  "people.staff": Users,
  "people.activity": Activity,
};

function section(key: SectionKey): Section {
  const menu = NAV_MENUS.find((m) => m.key === key)!;
  return {
    key,
    title: menu.title,
    tabs: menuTabs(menu).map((tab) => ({ ...tab, icon: TAB_ICONS[tab.id] ?? Package })),
  };
}

export const dashboardSections: Record<SectionKey, Section> = {
  sales: section("sales"),
  catalog: section("catalog"),
  reports: section("reports"),
  people: section("people"),
};

type User = Parameters<typeof canAccessTab>[0];

/** The section's tabs this user can open. */
export function accessibleTabs(key: SectionKey, user: User): SectionTab[] {
  return dashboardSections[key].tabs.filter((tab) => canAccessTab(user, tab));
}

/**
 * Every tab of the section, flagged with whether this user can open it. The
 * rail lists the open ones; the flag also tells it when the current page
 * isn't open.
 */
export function sectionTabs(key: SectionKey, user: User): (SectionTab & { allowed: boolean })[] {
  return dashboardSections[key].tabs.map((tab) => ({ ...tab, allowed: canAccessTab(user, tab) }));
}
