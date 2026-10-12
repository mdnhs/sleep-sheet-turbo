"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useCurrent } from "@/features/auth/api/use-current";
import { useSettings } from "@/features/settings/api/use-settings";
import {
  isTabActive,
  visibleTabs,
  type SectionKey,
} from "@/lib/dashboard-sections";
import { isValidSocialManagerUrl } from "@/lib/social-manager";
import { cn } from "@/lib/utils";

const subscribeNothing = () => () => {};

const tabClass = (active: boolean) =>
  cn(
    "group flex items-center gap-2.5 whitespace-nowrap rounded-xl border-2 px-2.5 py-1.5 text-sm font-medium transition-all duration-200 shadow-xs",
    active
      ? "border-primary bg-primary/5 text-foreground font-semibold dark:bg-primary/10"
      : "border-transparent bg-white text-muted-foreground hover:border-foreground/15 hover:text-foreground dark:bg-card",
  );

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
 * With a single visible tab there is nothing to switch, so no rail.
 *
 * The wrapper is always rendered and the rail only after mount: the server
 * doesn't know the user's permissions, so a rail decided during SSR would
 * not match the client's first render.
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
  const { data: settings } = useSettings();
  const socialUrl = (settings?.social_manager_url ?? "").trim();
  const tabs = React.useMemo(
    () => visibleTabs(section, user ?? null),
    [section, user],
  );
  const mounted = React.useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

  return (
    <div className="flex flex-col md:flex-row md:items-start">
      {mounted && tabs.length > 1 && (
        <nav
          aria-label="Section pages"
          className="flex gap-2 overflow-x-auto px-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:sticky md:top-14 md:w-48 md:shrink-0 md:flex-col md:overflow-visible md:pl-6 md:pr-0 md:pt-6"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            // Once the Postiz address is saved, "Social" opens it directly in a new tab.
            if (
              tab.socialManager &&
              socialUrl &&
              isValidSocialManagerUrl(socialUrl)
            ) {
              return (
                <a
                  key={tab.href}
                  href={socialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={tabClass(false)}
                >
                  <span className={iconClass(false)}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="truncate">{tab.title}</span>
                  <ExternalLink className="ml-auto size-3 text-muted-foreground/70" />
                </a>
              );
            }
            const active = isTabActive(tab, pathname);
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
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
