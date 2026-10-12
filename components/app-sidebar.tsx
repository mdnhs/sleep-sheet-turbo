"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

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
  IconBed,
  IconLayoutDashboard,
  IconPackage,
  IconSettings,
  IconDiscount,
  IconShoppingCart,
  IconChartBar,
  IconUsers,
} from "@tabler/icons-react"
import { useCurrent } from "@/features/auth/api/use-current"
import { canAccessTab, firstAccessibleTab } from "@/lib/tab-access"
import { accessibleTabs, dashboardSections, isTabActive, type SectionKey } from "@/lib/dashboard-sections"
import { settingsNav } from "@/app/(dashboard)/dashboard/settings/settings-nav"
import { useSettings } from "@/features/settings/api/use-settings"
import { storeProfileFromSettings } from "@/lib/settings/store-profile"

type SidebarItem = NavGroup["items"][number]

// One entry per area. A section's pages are vertical tabs inside the page
// (lib/dashboard-sections.ts); its entry opens the first tab the user can
// read and stays highlighted on every tab. Roles and the social manager
// live in Settings.
const sectionItems: { key: SectionKey; icon: React.ReactNode }[] = [
  { key: "sales", icon: <IconShoppingCart /> },
  { key: "catalog", icon: <IconPackage /> },
  { key: "reports", icon: <IconChartBar /> },
  { key: "people", icon: <IconUsers /> },
]

// A menu shows when the user's role opens at least one of its tabs
// (lib/tab-access.ts); the tabs it doesn't open are disabled inside the page.
export function buildItems(
  user: Parameters<typeof canAccessTab>[0],
  pathname: string
): SidebarItem[] {
  const items: SidebarItem[] = []
  if (canAccessTab(user, "dashboard")) {
    items.push({ title: "Dashboard", url: "/dashboard", icon: <IconLayoutDashboard /> })
  }
  for (const { key, icon } of sectionItems) {
    const tabs = accessibleTabs(key, user)
    if (tabs.length > 0) {
      items.push({
        title: dashboardSections[key].title,
        url: tabs[0].href,
        icon,
        isActive: tabs.some((tab) => isTabActive(tab, pathname)),
      })
    }
    // A page of its own, right after Catalog whether or not Catalog shows.
    if (key === "catalog" && canAccessTab(user, "promotions")) {
      items.push({ title: "Promotion", url: "/dashboard/promotions", icon: <IconDiscount /> })
    }
  }
  // Settings holds pages gated by other modules too (Roles: "roles"), so it
  // shows when any of them opens and goes to the first one.
  const settingsPage = firstAccessibleTab(user, settingsNav.flatMap((group) => group.items))
  if (settingsPage) {
    items.push({
      title: "Settings",
      url: settingsPage.href,
      icon: <IconSettings />,
      isActive: pathname.startsWith("/dashboard/settings"),
    })
  }
  return items
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

  const pathname = usePathname()
  const groups = React.useMemo<NavGroup[]>(
    () => [{ label: "", items: buildItems(user ?? null, pathname) }],
    [user, pathname]
  )

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
