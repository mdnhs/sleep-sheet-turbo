"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { IconChevronRight, IconExternalLink } from "@tabler/icons-react"

export interface NavItem {
  title: string
  url: string
  icon?: React.ReactNode
  isActive?: boolean
  // Opens in a new tab instead of navigating inside the admin panel.
  external?: boolean
  items?: {
    title: string
    url: string
  }[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export function NavMain({
  groups,
}: {
  groups: NavGroup[]
}) {
  const pathname = usePathname()
  // Frozen at first render — React guarantees a lazy useState initializer
  // runs exactly once, unlike reading ref.current during render (flagged by
  // the compiler: refs aren't guaranteed consistent there, e.g. under
  // Strict Mode's double-render).
  const [initialPathname] = useState(() => pathname)
  const { setOpenMobile } = useSidebar()

  const defaultOpen = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const group of groups) {
      for (const item of group.items) {
        if (item.items?.length) {
          map[item.title] = item.isActive || initialPathname.startsWith(item.url)
        }
      }
    }
    return map
  }, [groups, initialPathname])

  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <SidebarGroup key={group.label} className="py-1">
          <SidebarGroupLabel className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground/70 px-2 mb-1">
            {group.label}
          </SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) =>
              item.items && item.items.length > 0 ? (
                <Collapsible
                  key={item.title}
                  defaultOpen={defaultOpen[item.title]}
                  className="group/collapsible"
                  render={<SidebarMenuItem />}
                >
                  <CollapsibleTrigger
                    render={<SidebarMenuButton tooltip={item.title} isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)} />}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                    <IconChevronRight className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            render={<Link href={subItem.url} onClick={() => setOpenMobile(false)} />}
                            isActive={pathname === subItem.url}
                          >
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.title}>
                  {item.external ? (
                    <SidebarMenuButton
                      tooltip={item.title}
                      render={<a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpenMobile(false)} />}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                      <IconExternalLink className="ml-auto !size-3.5 text-muted-foreground/70" />
                    </SidebarMenuButton>
                  ) : (
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(`${item.url}/`))}
                    render={<Link href={item.url} onClick={() => setOpenMobile(false)} />}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              )
            )}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </div>
  )
}
