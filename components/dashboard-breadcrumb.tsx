"use client"

import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import React from "react"

const labels: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  products: "Products",
  categories: "Categories",
  settings: "Settings",
}

export function DashboardBreadcrumb() {
  const pathname = usePathname()

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((s) => !s.startsWith("("))

  const crumbs = segments.map((seg, i) => ({
    label: labels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
    href: "/" + segments.slice(0, i + 1).join("/"),
  }))

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <React.Fragment key={crumb.href}>
            {i > 0 && <BreadcrumbSeparator className="hidden md:block" />}
            <BreadcrumbItem className={i < crumbs.length - 1 ? "hidden md:block" : ""}>
              {i < crumbs.length - 1 ? (
                <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
