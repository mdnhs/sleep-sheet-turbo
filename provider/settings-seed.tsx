"use client";
import { useQueryClient } from "@tanstack/react-query";

// Seeds the ["settings"] query cache from server-fetched data before any
// descendant (Navbar, Footer, Hero) reads it. Runs during render on both the
// server (so SSR HTML shows real content instead of skeletons) and the first
// client render (so hydration matches). The guard keeps later client-side
// refetches from being clobbered.
export function SettingsSeed({
  settings,
  children,
}: {
  settings?: Record<string, string> | null;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const hasValidSettings = Boolean(
    settings &&
    typeof settings === "object" &&
    Object.keys(settings).length > 0 &&
    (settings.site_name || settings.hero_slides || settings.logo_url)
  );

  if (hasValidSettings && queryClient.getQueryData(["settings"]) === undefined) {
    queryClient.setQueryData(["settings"], settings);
  }
  return children;
}
