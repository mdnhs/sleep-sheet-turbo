import { startOfDay, subDays } from "date-fns";
import type { BucketUnit } from "./buckets";
import { NONE, type Dimension } from "./dimensions";
import { waEn, type WaKey } from "./wa-dictionary";
import type { Kpis, SeriesPoint } from "./types";

export type RangePreset = "today" | "7d" | "30d" | "90d" | "custom";
type FixedPreset = Exclude<RangePreset, "custom">;

export const RANGE_PRESETS: { value: FixedPreset; labelKey: WaKey }[] = [
  { value: "today", labelKey: "today" },
  { value: "7d", labelKey: "last7d" },
  { value: "30d", labelKey: "last30d" },
  { value: "90d", labelKey: "last90d" },
];

const PRESET_DAYS: Record<FixedPreset, number> = { today: 0, "7d": 6, "30d": 29, "90d": 89 };

/**
 * Local (browser) day starts; the admin's browser runs on Dhaka time. Every
 * preset ends at `now`, so the previous-period comparison covers the same
 * elapsed span ("Today" at 10:00 compares with yesterday 00:00-10:00).
 */
export function presetRange(preset: FixedPreset, now: Date): { from: string; to: string } {
  return {
    from: startOfDay(subDays(now, PRESET_DAYS[preset])).toISOString(),
    to: now.toISOString(),
  };
}

export const METRICS = ["visitors", "pageViews", "bounceRate", "orders", "revenue", "conversionRate"] as const;
export type Metric = (typeof METRICS)[number];

export function kpiValue(kpis: Kpis, metric: Metric): number {
  return kpis[metric];
}

export function pointValue(point: SeriesPoint, metric: Metric): number {
  switch (metric) {
    case "bounceRate":
      return point.sessions ? point.bounced / point.sessions : 0;
    case "conversionRate":
      return point.visitors ? point.orders / point.visitors : 0;
    default:
      return point[metric];
  }
}

export function trendPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function formatPercent(ratio: number): string {
  const percent = ratio * 100;
  return `${percent > 0 && percent < 10 ? percent.toFixed(1) : Math.round(percent)}%`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  bn: ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"],
};

/** Labels a SeriesPoint bucket ("YYYY-MM-DDTHH:mm:ss", Dhaka wall clock). */
export function bucketLabel(bucket: string, unit: BucketUnit, language: "en" | "bn" = "en"): string {
  const [date, time = "00"] = bucket.split("T");
  const [year, month, day] = date.split("-").map(Number);
  if (unit === "hour") return `${time.slice(0, 2)}:00`;
  const monthName = MONTHS[language][month - 1];
  if (unit === "day") return `${monthName} ${day}`;
  return `${monthName} ${year}`;
}

export function keyLabel(dim: Dimension, key: string | null, t: (key: WaKey) => string = (k) => waEn[k]): string {
  if (key) return key;
  if (dim === "referrer") return t("keyDirect");
  if (dim === "utmSource" || dim === "utmMedium" || dim === "utmCampaign") return t("keyNotSet");
  return t("keyUnknown");
}

export function filterValueLabel(dim: Dimension, value: string, t?: (key: WaKey) => string): string {
  return value === NONE ? keyLabel(dim, null, t) : value;
}
