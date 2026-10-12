"use client";

import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { useCurrent } from "@/features/auth/api/use-current";
import { can } from "@/lib/permissions";
import { useWaT } from "../lib/i18n";

export function useTrackingEnabled(): boolean {
  const { data: settings } = useSettings();
  return settings?.analytics_enabled !== "false";
}

export function TrackingToggle() {
  const enabled = useTrackingEnabled();
  const { data: user } = useCurrent();
  const update = useUpdateSettings();
  const t = useWaT();
  // The PATCH checks settings:write too; this only greys the switch out.
  const canEdit = can((user ?? null) as Parameters<typeof can>[0], "settings", "write");

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("tracking")}</span>
      <Switch
        checked={enabled}
        disabled={!canEdit || update.isPending}
        onCheckedChange={(checked) => update.mutate({ analytics_enabled: checked ? "true" : "false" })}
      />
      <span className="w-6 font-medium">{enabled ? t("on") : t("off")}</span>
    </label>
  );
}

export function TrackingOffBanner() {
  const enabled = useTrackingEnabled();
  const t = useWaT();
  if (enabled) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {t("trackingOffBanner")}
    </div>
  );
}
