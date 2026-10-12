import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Banknote,
  BarChart3,
  Calculator,
  FileText,
  FolderTree,
  Image as ImageIcon,
  LineChart,
  MessageSquareQuote,
  Package,
  Share2,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  Users,
} from "lucide-react";
import { can, type ModuleKey } from "@/lib/permissions";

// The admin sidebar shows one entry per section; the pages inside a section
// are vertical tabs on the left of the page (components/section-shell.tsx).
// URLs are unchanged: each section is a route group under app/(dashboard)/dashboard.

export type SectionKey = "sales" | "catalog" | "reports" | "people";

export interface SectionTab {
  title: string;
  href: string;
  icon: LucideIcon;
  module: ModuleKey;
  /** Replaced by the saved Postiz address, opened in a new tab (see SectionShell). */
  socialManager?: true;
}

export interface Section {
  key: SectionKey;
  title: string;
  tabs: SectionTab[];
}

export const dashboardSections: Record<SectionKey, Section> = {
  sales: {
    key: "sales",
    title: "Sales",
    tabs: [
      { title: "Orders", href: "/dashboard/orders", icon: ShoppingCart, module: "orders" },
      { title: "POS", href: "/dashboard/pos", icon: Calculator, module: "pos" },
      { title: "Fraud Checker", href: "/dashboard/fraud-checker", icon: ShieldCheck, module: "orders" },
    ],
  },
  catalog: {
    key: "catalog",
    title: "Catalog",
    tabs: [
      { title: "Products", href: "/dashboard/products", icon: Package, module: "products" },
      { title: "Categories", href: "/dashboard/categories", icon: FolderTree, module: "products" },
      { title: "Images", href: "/dashboard/images", icon: ImageIcon, module: "products" },
      { title: "Blog", href: "/dashboard/blog", icon: FileText, module: "blog" },
      { title: "Testimonials", href: "/dashboard/testimonials", icon: MessageSquareQuote, module: "testimonials" },
      { title: "Social", href: "/dashboard/settings/social", icon: Share2, module: "blog", socialManager: true },
    ],
  },
  reports: {
    key: "reports",
    title: "Reports",
    tabs: [
      { title: "Reports", href: "/dashboard/reports", icon: BarChart3, module: "reports" },
      { title: "Analytics", href: "/dashboard/analytics", icon: LineChart, module: "reports" },
      { title: "Expenses", href: "/dashboard/expenses", icon: Banknote, module: "expenses" },
    ],
  },
  people: {
    key: "people",
    title: "People",
    tabs: [
      { title: "Customers", href: "/dashboard/customers", icon: UserRound, module: "users" },
      { title: "Staff", href: "/dashboard/users", icon: Users, module: "users" },
      { title: "Activity Log", href: "/dashboard/activity", icon: Activity, module: "activity" },
    ],
  },
};

type User = Parameters<typeof can>[0];

/** The section's tabs this user can open. */
export function visibleTabs(key: SectionKey, user: User): SectionTab[] {
  return dashboardSections[key].tabs.filter((tab) => can(user, tab.module, "read"));
}

export function isTabActive(tab: SectionTab, pathname: string): boolean {
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}
