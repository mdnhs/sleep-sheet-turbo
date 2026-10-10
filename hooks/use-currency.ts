"use client";

import { useSettings } from "@/features/settings/api/use-settings";

export const SUPPORTED_CURRENCIES = [
  { code: "BDT", symbol: "৳", label: "Bangladeshi Taka (৳)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham (د.إ)" },
] as const;

const SYMBOL_MAP = Object.fromEntries(
  SUPPORTED_CURRENCIES.map(({ code, symbol }) => [code, symbol])
);

export function useCurrency() {
  const { data: settings } = useSettings();
  const code = settings?.currency ?? "BDT";
  const symbol = SYMBOL_MAP[code] ?? code;

  const formatAmount = (value?: number | null) => {
    const num = typeof value === "number" && !isNaN(value) ? value : Number(value) || 0;
    return `${symbol}${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };

  return { code, symbol, formatAmount };
}
