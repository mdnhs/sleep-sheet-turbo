"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrent } from "@/features/auth/api/use-current";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { settingsNav } from "./settings-nav";


export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: user } = useCurrent();

  // Keep only tabs the user can open, then drop groups left empty.
  const groups = React.useMemo(
    () =>
      settingsNav
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => can(user ?? null, item.module, "read")),
        }))
        .filter((group) => group.items.length > 0),
    [user]
  );

  const activeGroup = groups.find((group) =>
    group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  );

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your store configuration, integrations, and preferences
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Left tabs: one per group. Horizontal scroll on mobile. Styled like account page tabs. */}
        <nav
          aria-label="Settings sections"
          className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:w-56 md:shrink-0 md:flex-col md:overflow-visible"
        >
          {groups.map((group) => {
            const Icon = group.icon;
            const isActive = group.key === activeGroup?.key;
            return (
              <Link
                key={group.key}
                href={group.items[0].href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 whitespace-nowrap rounded-2xl border-2 px-3.5 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer shadow-xs",
                  isActive
                    ? "border-primary bg-primary/5 text-foreground font-semibold dark:bg-primary/10"
                    : "border-transparent bg-white text-muted-foreground hover:border-foreground/15 hover:text-foreground dark:bg-card"
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-xl transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-[#F4F4F4] text-muted-foreground group-hover:text-foreground dark:bg-gray-700 dark:text-muted-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="truncate">{group.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {/* Nested tabs: pages inside the active group. */}
          {activeGroup && activeGroup.items.length > 1 && (
            <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <nav
                aria-label={`${activeGroup.title} settings`}
                className="inline-flex flex-nowrap items-center h-10 w-max sm:w-fit gap-1 bg-slate-200 dark:bg-card p-1 rounded-full border-none shadow-none"
              >
                {activeGroup.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all border-none",
                        isActive
                          ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
