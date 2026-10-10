export type BucketUnit = "hour" | "day" | "month";

/** The store's clock: chart buckets and "today" are Dhaka days, not UTC days. */
export const ANALYTICS_TZ = "Asia/Dhaka";

const DAY_MS = 24 * 60 * 60 * 1000;

export function bucketUnit(start: Date, end: Date): BucketUnit {
  const days = (end.getTime() - start.getTime()) / DAY_MS;
  if (days <= 2) return "hour";
  if (days <= 92) return "day";
  return "month";
}
