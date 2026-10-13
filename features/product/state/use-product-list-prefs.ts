"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** The dashboard products list's last page size, filters and layout; unset = never changed. */
export interface ProductListPrefs {
  limit?: number;
  category?: string;
  featured?: string;
  sort?: string;
  /** "grid" | "table" — the duplicates report is never remembered. */
  view?: string;
}

interface ProductListPrefsState extends ProductListPrefs {
  remember: (prefs: ProductListPrefs) => void;
}

export const useProductListPrefs = create<ProductListPrefsState>()(
  persist(
    (set) => ({
      remember: (prefs) => set(prefs),
    }),
    {
      name: "dashboard-products-prefs",
      partialize: ({ limit, category, featured, sort, view }) => ({ limit, category, featured, sort, view }),
      // Rehydrated from a client effect so the server render and the client's
      // first render agree (see use-language-store.ts).
      skipHydration: true,
    }
  )
);

/** Saved prefs from localStorage; `{}` when nothing was saved. */
export async function loadProductListPrefs(): Promise<ProductListPrefs> {
  await useProductListPrefs.persist.rehydrate();
  const { limit, category, featured, sort, view } = useProductListPrefs.getState();
  return { limit, category, featured, sort, view };
}
