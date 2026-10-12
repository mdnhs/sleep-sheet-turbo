"use client";

import * as React from "react";
import { useCurrent } from "@/features/auth/api/use-current";
import { NAV_TAB_BY_ID } from "@/lib/dashboard-nav";
import { canAccessSubTab } from "@/lib/tab-access";

/**
 * Which in-page tabs of a dashboard page (lib/dashboard-nav.ts `subtabs`) the
 * current user's role opens. Tabs it doesn't open stay visible but disabled:
 *
 *   const sub = useSubTabs("sales.orders");
 *   const shown = sub.pick(value);           // falls back to the first open tab
 *   <TabsTrigger value="PENDING" disabled={!sub.allowed("PENDING")} />
 *
 * Everything counts as open while the user is loading, and for MODERATOR,
 * whose access is decided per page/route.
 */
export function useSubTabs(tabId: string) {
  const { data: user } = useCurrent();
  return React.useMemo(() => {
    const keys = NAV_TAB_BY_ID.get(tabId)?.subtabs?.map((sub) => sub.key) ?? [];
    const allowed = (key: string) =>
      user === undefined || user?.role === "MODERATOR" || canAccessSubTab(user, tabId, key);
    const first = keys.find(allowed) ?? keys[0];
    return {
      allowed,
      first,
      /** `value` when it's open, otherwise the first open tab. */
      pick: <T extends string>(value: T): T => (allowed(value) ? value : (first as T)),
    };
  }, [user, tabId]);
}
