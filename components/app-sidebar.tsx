"use client"

import * as React from "react"
import Link from "next/link"

import { NavMain, type NavGroup } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  IconArticle,
  IconBed,
  IconCashRegister,
  IconCategory,
  IconLayoutDashboard,
  IconPackage,
  IconPhoto,
  IconSettings,
  IconShoppingCart,
  IconChartBar,
  IconReceipt2,
  IconUsers,
  IconUserHeart,
  IconShield,
  IconShieldSearch,
  IconHistory,
  IconBrandGoogleAnalytics,
  IconShare3,
} from "@tabler/icons-react"
import { useCurrent } from "@/features/auth/api/use-current"
import { can, type ModuleKey } from "@/lib/permissions"
import { useSettings } from "@/features/settings/api/use-settings"
import { storeProfileFromSettings } from "@/lib/settings/store-profile"
import { isValidSocialManagerUrl } from "@/lib/social-manager"

// `module` gates an item: shown only if the user can read that module.
// Items with no `module` are always visible.
type GatedItem = {
  title: string
  url: string
  external?: boolean
  icon?: React.ReactNode
  module?: ModuleKey
  items?: { title: string; url: string }[]
}
type GatedGroup = { label: string; items: GatedItem[] }

const navGroups: GatedGroup[] = [
  {
    label: "Main",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: <IconLayoutDashboard />, module: "dashboard" },
      { title: "Reports", url: "/dashboard/reports", icon: <IconChartBar />, module: "reports" },
      { title: "Analytics", url: "/dashboard/analytics", icon: <IconBrandGoogleAnalytics />, module: "reports" },
    ],
  },
  {
    label: "Sales & POS",
    items: [
      { title: "Orders", url: "/dashboard/orders", icon: <IconShoppingCart />, module: "orders" },
      { title: "Fraud Checker", url: "/dashboard/fraud-checker", icon: <IconShieldSearch />, module: "orders" },
      { title: "POS", url: "/dashboard/pos", icon: <IconCashRegister />, module: "pos" },
      { title: "Expenses", url: "/dashboard/expenses", icon: <IconReceipt2 />, module: "expenses" },
    ],
  },
  {
    label: "Catalog & Content",
    items: [
      { title: "Products", url: "/dashboard/products", icon: <IconPackage />, module: "products" },
      { title: "Categories", url: "/dashboard/categories", icon: <IconCategory />, module: "products" },
      { title: "Images", url: "/dashboard/images", icon: <IconPhoto />, module: "products" },
      { title: "Blog", url: "/dashboard/blog", icon: <IconArticle />, module: "blog" },
      { title: "Testimonials", url: "/dashboard/testimonials", icon: <IconBed />, module: "testimonials" },
      // url/external are filled in from the saved Postiz address (see AppSidebar);
      // until one is set this points at its setup page.
      { title: "Social", url: "/dashboard/settings/social", icon: <IconShare3 />, module: "blog" },
    ],
  },
  {
    label: "People & Security",
    items: [
      { title: "Customers", url: "/dashboard/customers", icon: <IconUserHeart />, module: "users" },
      { title: "Staff", url: "/dashboard/users", icon: <IconUsers />, module: "users" },
      { title: "Roles", url: "/dashboard/settings/roles", icon: <IconShield />, module: "roles" },
      { title: "Activity Log", url: "/dashboard/activity", icon: <IconHistory />, module: "activity" },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: <IconSettings />,
        module: "settings",
      },
    ],
  },
]

// Keep only items the user can see, then drop groups left empty.
function filterGroups(
  groups: GatedGroup[],
  user: { role?: string; permissions?: string[] } | null | undefined
): NavGroup[] {
  return groups
    .map((group) => ({
      label: group.label,
      items: group.items.filter(
        (item) => !item.module || can(user ?? null, item.module, "read")
      ),
    }))
    .filter((group) => group.items.length > 0)
}

export function AppSidebarSkeleton() {
  return (
    <div className="space-y-3 py-1 animate-pulse" data-slot="sidebar-skeleton">
      <SidebarGroup className="py-1">
        <div className="px-3 mb-1.5 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-3 w-12 rounded-md bg-muted/80" />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="72%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="60%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="80%" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup className="py-1">
        <div className="px-3 mb-1.5 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-3 w-20 rounded-md bg-muted/80" />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="65%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="55%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="75%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="60%" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup className="py-1">
        <div className="px-3 mb-1.5 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-3 w-28 rounded-md bg-muted/80" />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="78%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="68%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="58%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="72%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="62%" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup className="py-1">
        <div className="px-3 mb-1.5 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-3 w-24 rounded-md bg-muted/80" />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="64%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="56%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="70%" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="66%" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup className="py-1">
        <div className="px-3 mb-1.5 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-3 w-16 rounded-md bg-muted/80" />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon width="60%" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </div>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setOpenMobile } = useSidebar()
  const { data: user, isLoading } = useCurrent()

  const { data: settings } = useSettings()
  const socialUrl = (settings?.social_manager_url ?? "").trim()

  const groups = React.useMemo(() => {
    const visible = filterGroups(navGroups, user)
    // Once the Postiz address is saved, "Social" opens it directly in a new tab.
    if (!socialUrl || !isValidSocialManagerUrl(socialUrl)) return visible
    return visible.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.title === "Social" ? { ...item, url: socialUrl, external: true } : item
      ),
    }))
  }, [user, socialUrl])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" onClick={() => setOpenMobile?.(false)} />}>
              <div className="flex aspect-square size-8.5 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 text-white shadow-sm shadow-rose-500/20">
                <IconBed className="size-4.5" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-bold tracking-tight text-foreground text-sm">{storeProfileFromSettings(settings).name}</span>
                <span className="text-[10px] font-semibold tracking-wide uppercase text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-full w-fit">Admin Panel</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {isLoading ? (
          <AppSidebarSkeleton />
        ) : (
          <NavMain groups={groups} />
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
