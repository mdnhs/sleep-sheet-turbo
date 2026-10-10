"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";
import type { SecretSettingKey, SettingsPatch } from "@/lib/settings/registry";
import { settingsErrorMessage } from "@/features/settings/api/settings-error";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      // The storefront copy is CDN-cached for minutes (see the settings
      // route), which is fine for visitors but wrong for an admin who just
      // saved: a reload would show the old value and look like the save
      // didn't stick. In the dashboard a unique query string skips that
      // cache and reads the (tag-invalidated) origin copy instead.
      const inDashboard =
        typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard");
      const res = inDashboard
        ? await fetch(`/api/settings?fresh=${Date.now()}`, { cache: "no-store" })
        : await client.api.settings.$get();
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json() as Promise<Record<string, string>>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Admin-only: fetches secret values (API keys, the CAPI token) that the
// public settings endpoint intentionally omits.
export function useSettingsSecrets() {
  return useQuery({
    queryKey: ["settings", "secrets"],
    queryFn: async () => {
      const res = await client.api.settings.secrets.$get();
      if (!res.ok) throw new Error("Failed to fetch settings secrets");
      return res.json() as Promise<Record<SecretSettingKey, string>>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SettingsPatch) => {
      const res = await client.api.settings.$patch({ json: data });
      if (!res.ok) throw new Error(settingsErrorMessage(await res.json().catch(() => null)));
      return res.json();
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save settings");
    },
  });
}
