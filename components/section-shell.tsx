"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrent } from "@/features/auth/api/use-current";
import {
  isTabActive,
  sectionTabs,
  type SectionKey,
} from "@/lib/dashboard-sections";
import { NoTabAccess } from "@/components/no-tab-access";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const subscribeNothing = () => () => {};

const tabClass = (active: boolean) =>
  cn(
    "group flex items-center gap-2.5 whitespace-nowrap rounded-xl border-2 px-2.5 py-1.5 text-sm font-medium transition-all duration-200 shadow-xs",
    active
      ? "border-primary bg-primary/5 text-foreground font-semibold dark:bg-primary/10"
      : "border-transparent bg-white text-muted-foreground hover:border-foreground/15 hover:text-foreground dark:bg-card",
  );

const railClass =
  "flex gap-2 overflow-x-auto px-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:sticky md:top-14 md:w-48 md:shrink-0 md:flex-col md:overflow-visible md:pl-6 md:pr-0 md:pt-6";

const iconClass = (active: boolean) =>
  cn(
    "flex size-6 shrink-0 items-center justify-center rounded-lg transition-colors",
    active
      ? "bg-primary text-primary-foreground"
      : "bg-[#F4F4F4] text-muted-foreground group-hover:text-foreground dark:bg-gray-700 dark:text-muted-foreground",
  );

/**
 * Vertical tabs for the pages of one sidebar section (left rail on desktop,
 * a scrolling row on mobile). Pages keep their own padding and headings.
 *
 * Only the tabs the user's role opens are listed; opening any other page of
 * the section directly shows a "no access" notice. (The in-page tabs inside
 * a page are disabled instead, see hooks/use-sub-tabs.ts.) With a single
 * open tab there is nothing to switch, so no rail.
 *
 * The server doesn't know the user's permissions, so until the client has
 * mounted and loaded the user the rail is a skeleton of the section's tabs
 * (same box, so the page beside it doesn't jump).
 */
export function SectionShell({
  section,
  children,
}: {
  section: SectionKey;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: user } = useCurrent();
  const tabs = React.useMemo(
    () => sectionTabs(section, user ?? null),
    [section, user],
  );
  const mounted = React.useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  const openTabs = tabs.filter((tab) => tab.allowed);
  const pending = !mounted || user === undefined;
  const activeTab = tabs.find((tab) => isTabActive(tab, pathname));
  // `user` is undefined while loading: keep showing the page until we know.
  // MODERATOR access is decided per page/route (isAllowed bypasses), not here.
  const blocked =
    mounted && user !== undefined && user?.role !== "MODERATOR" && activeTab && !activeTab.allowed;

  return (
    <div className="flex flex-col md:flex-row md:items-start">
      {pending && tabs.length > 1 && (
        <div aria-hidden className={railClass}>
          {tabs.map((tab) => (
            <div key={tab.href} className="flex shrink-0 items-center gap-2.5 rounded-xl border-2 border-transparent bg-white px-2.5 py-1.5 shadow-xs dark:bg-card">
              <Skeleton className="size-6 shrink-0 rounded-lg" />
              <Skeleton className="h-3.5 w-20 rounded-md" />
            </div>
          ))}
        </div>
      )}
      {!pending && openTabs.length > 1 && (
        <nav aria-label="Section pages" className={railClass}>
          {openTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab === activeTab;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                <span className={iconClass(active)}>
                  <Icon className="size-3.5" />
                </span>
                <span className="truncate">{tab.title}</span>
              </Link>
            );
          })}
        </nav>
      )}
      <div className="min-w-0 flex-1">
        {blocked ? <NoTabAccess title={activeTab.title} /> : children}
      </div>
    </div>
  );
}
