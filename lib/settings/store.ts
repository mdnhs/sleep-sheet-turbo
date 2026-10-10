import { cache } from "react";
import { getPublicSettings } from "@/lib/prefetch-home";
import { siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";

// The same cached, "settings"-tagged read both layouts already make, so a
// render that asks for the profile costs no extra query, and a settings save
// refreshes every page that used it (the tag reaches the page's cache entry).
const publicSettings = cache(() =>
  getPublicSettings().catch((err: unknown) => {
    // Falling back to defaults keeps the page up; say so, or a broken read
    // silently shows the wrong store name everywhere.
    console.error("[settings] public settings read failed, using defaults:", err instanceof Error ? err.message : "unknown error");
    return null;
  }),
);

export const getStoreProfile = cache(async () => storeProfileFromSettings(await publicSettings()));
export const getSiteSeo = cache(async () => siteSeoFromSettings(await publicSettings()));
