"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrent } from "@/features/auth/api/use-current";
import { isTabActive } from "@/lib/dashboard-nav";
import { canAccessTab } from "@/lib/tab-access";
import { cn } from "@/lib/utils";
import { NoTabAccess } from "@/components/no-tab-access";
import { Skeleton } from "@/components/ui/skeleton";
import { settingsNav } from "./settings-nav";

/**
 * Settings has two tab levels: groups on the left, the group's pages across
 * the top. Only the groups and pages the user's role opens are listed;
 * opening any other page directly shows a "no access" notice. (The in-page
 * tabs inside a page are disabled instead, see hooks/use-sub-tabs.ts.)
 *
 * The server doesn't know the user's permissions, so until the client has
 * mounted and loaded the user both tab levels are skeletons.
 */
const subscribeNothing = () => () => {};

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: user } = useCurrent();
  const mounted = React.useSyncExternalStore(subscribeNothing, () => true, () => false);
  const pending = !mounted || user === undefined;

  const allGroups = React.useMemo(
    () =>
      settingsNav.map((group) => ({
        ...group,
        items: group.items.map((item) => ({ ...item, allowed: canAccessTab(user ?? null, item) })),
      })),
    [user]
  );
  const groups = allGroups.filter((group) => group.items.some((item) => item.allowed));

  const activeGroup = allGroups.find((group) => group.items.some((item) => isTabActive(item, pathname)));
  const activeItem = activeGroup?.items.find((item) => isTabActive(item, pathname));
  // `user` is undefined while loading: keep showing the page until we know.
  // MODERATOR access is decided per page/route (isAllowed bypasses), not here.
  const blocked = !pending && user?.role !== "MODERATOR" && activeItem && !activeItem.allowed;
  const openItems = activeGroup?.items.filter((item) => item.allowed) ?? [];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Left tabs: one per group. Horizontal scroll on mobile. Styled like account page tabs. */}
        <nav
          aria-label="Settings sections"
          className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:w-56 md:shrink-0 md:flex-col md:overflow-visible"
        >
          {pending &&
            settingsNav.map((group) => (
              <div
                key={group.key}
                aria-hidden
                className="flex shrink-0 items-center gap-3 rounded-2xl border-2 border-transparent bg-white px-3.5 py-2.5 shadow-xs dark:bg-card"
              >
                <Skeleton className="size-7 shrink-0 rounded-xl" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
            ))}
          {!pending && groups.map((group) => {
            const Icon = group.icon;
            const isActive = group.key === activeGroup?.key;
            return (
              <Link
                key={group.key}
                href={group.items.find((item) => item.allowed)!.href}
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
          {pending && activeGroup && activeGroup.items.length > 1 && (
            <div aria-hidden className="inline-flex h-10 w-max max-w-full items-center gap-1 overflow-hidden rounded-full bg-slate-200 p-1 dark:bg-card">
              {activeGroup.items.map((item) => (
                <Skeleton key={item.href} className="h-8 w-24 shrink-0 rounded-full bg-white/70 dark:bg-muted" />
              ))}
            </div>
          )}
          {!pending && activeGroup && openItems.length > 1 && (
            <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <nav
                aria-label={`${activeGroup.title} settings`}
                className="inline-flex flex-nowrap items-center h-10 w-max sm:w-fit gap-1 bg-slate-200 dark:bg-card p-1 rounded-full border-none shadow-none"
              >
                {openItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item === activeItem;
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

          {blocked ? <NoTabAccess title={activeItem.title} /> : children}
        </div>
      </div>
    </div>
  );
}
