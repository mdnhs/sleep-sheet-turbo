import { startOfDay, subDays } from "date-fns";
import type { BucketUnit } from "./buckets";
import { NONE, type Dimension } from "./dimensions";
import type { Kpis, SeriesPoint } from "./types";

export type RangePreset = "today" | "7d" | "30d" | "90d" | "custom";
type FixedPreset = Exclude<RangePreset, "custom">;

export const RANGE_PRESETS: { value: FixedPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
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

export const METRIC_LABELS: Record<Metric, string> = {
  visitors: "Visitors",
  pageViews: "Page views",
  bounceRate: "Bounce rate",
  orders: "Website orders",
  revenue: "Revenue",
  conversionRate: "Conversion rate",
};

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Labels a SeriesPoint bucket ("YYYY-MM-DDTHH:mm:ss", Dhaka wall clock). */
export function bucketLabel(bucket: string, unit: BucketUnit): string {
  const [date, time = "00"] = bucket.split("T");
  const [year, month, day] = date.split("-").map(Number);
  if (unit === "hour") return `${time.slice(0, 2)}:00`;
  if (unit === "day") return `${MONTHS[month - 1]} ${day}`;
  return `${MONTHS[month - 1]} ${year}`;
}

export const DIMENSION_LABELS: Record<Dimension, string> = {
  path: "Page",
  route: "Route",
  hostname: "Hostname",
  referrer: "Referrer",
  utmSource: "UTM source",
  utmMedium: "UTM medium",
  utmCampaign: "UTM campaign",
  country: "Country",
  device: "Device",
  browser: "Browser",
  os: "OS",
};

export function keyLabel(dim: Dimension, key: string | null): string {
  if (key) return key;
  if (dim === "referrer") return "Direct";
  if (dim === "utmSource" || dim === "utmMedium" || dim === "utmCampaign") return "(not set)";
  return "Unknown";
}

export function filterValueLabel(dim: Dimension, value: string): string {
  return value === NONE ? keyLabel(dim, null) : value;
}
