import { subDays, subWeeks } from "date-fns";

export const getDateRange = (period: string) => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  switch (period) {
    case "all":
    case "all-time":
      // From the epoch — effectively "no lower bound" without special-casing
      // the query builder, since no real order predates 1970.
      return { startDate: new Date(0), endDate: now };
    case "this-month":
    case "month": {
      const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
      return { startDate, endDate };
    }
    case "last-month": {
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      return { startDate, endDate };
    }
    case "3-months": {
      const startDate = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0, 0));
      return { startDate, endDate: now };
    }
    case "6-months": {
      const startDate = new Date(Date.UTC(year, month - 5, 1, 0, 0, 0, 0));
      return { startDate, endDate: now };
    }
    case "12-months":
    case "year": {
      const startDate = new Date(Date.UTC(year, month - 11, 1, 0, 0, 0, 0));
      return { startDate, endDate: now };
    }
    case "day":
      return { startDate: subDays(now, 1), endDate: now };
    case "week":
      return { startDate: subWeeks(now, 1), endDate: now };
    default: {
      const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
      return { startDate, endDate };
    }
  }
};

// Same-length window immediately before an arbitrary [startDate, endDate) range
export const getPreviousRange = (startDate: Date, endDate: Date) => {
  const spanMs = endDate.getTime() - startDate.getTime();
  return {
    startDate: new Date(startDate.getTime() - spanMs),
    endDate: startDate,
  };
};

// Same-length window immediately before the current one, for period-over-period deltas
export const getPreviousDateRange = (period: string) => {
  const { startDate, endDate } = getDateRange(period);
  return getPreviousRange(startDate, endDate);
};

// A custom "from"/"to" pair (query params) takes priority over a preset period.
export const resolveDateRange = (period: string, from?: string, to?: string) => {
  if (from && to) {
    const startDate = new Date(from);
    const endDate = new Date(to);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
      if (!from.includes("T")) startDate.setHours(0, 0, 0, 0);
      if (!to.includes("T") || endDate.getHours() === 0) endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
  }
  return getDateRange(period);
};

// Daily buckets read badly over a long range; roll up to a coarser unit
export const getTrendBucketUnit = (startDate: Date, endDate: Date): "day" | "month" => {
  const spanDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (spanDays > 45) return "month";
  return "day";
};

export function getStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      return new Date(now.getFullYear(), now.getMonth(), diff);
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
