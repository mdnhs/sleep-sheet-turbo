import {
  Building2,
  CreditCard,
  DollarSign,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Megaphone,
  Search,
  Share2,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { NAV_MENUS, type NavTab } from "@/lib/dashboard-nav";

// A settings page. `module` is what its tab also needs `read` on: Roles live
// under /settings but are gated by their own module, not "settings".
export type SettingsNavItem = NavTab & { icon: LucideIcon };

export type SettingsNavGroup = {
  key: string;
  title: string;
  icon: LucideIcon;
  items: SettingsNavItem[];
};

const GROUP_ICONS: Record<string, LucideIcon> = {
  store: Store,
  marketing: Megaphone,
  content: Globe,
  access: Users,
};

const ITEM_ICONS: Record<string, LucideIcon> = {
  "settings.store": Building2,
  "settings.business": SlidersHorizontal,
  "settings.pos": Store,
  "settings.currency": DollarSign,
  "settings.payments": CreditCard,
  "settings.shipping": Truck,
  "settings.seo": Search,
  "settings.catalog": ShoppingBag,
  "settings.social": Share2,
  "settings.website": Globe,
  "settings.cdn": ImageIcon,
  "settings.roles": Shield,
  "settings.api-keys": KeyRound,
};

// Left tabs are the groups; the tabs across the top of the content are the
// pages inside the active group. Defined in lib/dashboard-nav.ts.
export const settingsNav: SettingsNavGroup[] = (
  NAV_MENUS.find((menu) => menu.key === "settings")?.groups ?? []
).map((group) => ({
  key: group.key,
  title: group.title,
  icon: GROUP_ICONS[group.key] ?? Store,
  items: group.tabs.map((tab) => ({ ...tab, icon: ITEM_ICONS[tab.id] ?? Store })),
}));
