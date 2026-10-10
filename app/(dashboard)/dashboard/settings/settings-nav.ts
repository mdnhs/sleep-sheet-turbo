import {
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
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/lib/permissions";

export type SettingsNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  // Module the user needs `read` on to see the tab. Roles live under
  // /settings but are gated by their own module, not "settings".
  module: ModuleKey;
};

export type SettingsNavGroup = {
  key: string;
  title: string;
  icon: LucideIcon;
  items: SettingsNavItem[];
};

// Left tabs are the groups; the tabs across the top of the content are the
// pages inside the active group.
export const settingsNav: SettingsNavGroup[] = [
  {
    key: "store",
    title: "Store",
    icon: Store,
    items: [
      { title: "POS", href: "/dashboard/settings/pos", icon: Store, module: "settings" },
      { title: "Currency", href: "/dashboard/settings/currency", icon: DollarSign, module: "settings" },
      { title: "Payments", href: "/dashboard/settings/payments", icon: CreditCard, module: "settings" },
      { title: "Shipping & Courier", href: "/dashboard/settings/shipping", icon: Truck, module: "settings" },
    ],
  },
  {
    key: "marketing",
    title: "Marketing",
    icon: Megaphone,
    items: [
      { title: "SEO", href: "/dashboard/settings/seo", icon: Search, module: "settings" },
      { title: "Meta Catalog", href: "/dashboard/settings/catalog", icon: ShoppingBag, module: "settings" },
      { title: "Social Manager", href: "/dashboard/settings/social", icon: Share2, module: "settings" },
    ],
  },
  {
    key: "content",
    title: "Content",
    icon: Globe,
    items: [
      { title: "Website", href: "/dashboard/settings/website", icon: Globe, module: "settings" },
      { title: "CDN", href: "/dashboard/settings/cdn", icon: ImageIcon, module: "settings" },
    ],
  },
  {
    key: "access",
    title: "Access",
    icon: Users,
    items: [
      { title: "Roles & Permissions", href: "/dashboard/settings/roles", icon: Shield, module: "roles" },
      { title: "API Keys", href: "/dashboard/settings/api-keys", icon: KeyRound, module: "settings" },
    ],
  },
];
