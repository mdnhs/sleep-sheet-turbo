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
  settings: Record<string, string>;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  if (queryClient.getQueryData(["settings"]) === undefined) {
    queryClient.setQueryData(["settings"], settings);
  }
  return children;
}
