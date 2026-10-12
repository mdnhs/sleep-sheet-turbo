"use client";

import { useLanguage, type Language } from "@/hooks/use-language";
import { waBn, waEn, type WaKey } from "./wa-dictionary";

export type { WaKey };

const dictionaries: Record<Language, Record<WaKey, string>> = { en: waEn, bn: waBn };

export function useWaT(): (key: WaKey) => string {
  const { language } = useLanguage();
  return (key) => dictionaries[language]?.[key] ?? waEn[key];
}
