"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Language = "en" | "bn";

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "bn",
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: "language",
      // Hydration is deferred to a client-only effect (see useLanguage) so the
      // server-rendered default ("bn") matches the client's first render —
      // reading localStorage at store-creation time would hydrate before
      // React reconciles against the server HTML and trigger a mismatch.
      skipHydration: true,
    }
  )
);

let hasHydrated = false;

// Reads localStorage once for the whole app, no matter how many components
// call useLanguage() on initial mount.
export function hydrateLanguageStore() {
  if (hasHydrated) return;
  hasHydrated = true;
  useLanguageStore.persist.rehydrate();
}
