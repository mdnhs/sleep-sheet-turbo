"use client";

import { useMemo } from "react";
import { useSettings } from "@/features/settings/api/use-settings";
import { storeProfileFromSettings, type StoreProfile } from "@/lib/settings/store-profile";

/** The store profile from the ["settings"] query the (client) layout seeds: no extra request. */
export function useStoreProfile(): StoreProfile {
  const { data } = useSettings();
  return useMemo(() => storeProfileFromSettings(data), [data]);
}
