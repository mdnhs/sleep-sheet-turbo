import { describe, expect, it } from "vitest";
import {
  bucketLabel,
  filterValueLabel,
  formatPercent,
  keyLabel,
  pointValue,
  presetRange,
  trendPercent,
} from "./format";
import { NONE } from "./dimensions";
import type { SeriesPoint } from "./types";

describe("presetRange", () => {
  const now = new Date(2026, 9, 10, 15, 30); // local time, Oct 10 15:30

  it("covers today from local midnight to now", () => {
    expect(presetRange("today", now)).toEqual({
      from: new Date(2026, 9, 10, 0, 0, 0, 0).toISOString(),
      to: now.toISOString(),
    });
  });

  it("counts today as one of the last 7 days", () => {
    expect(presetRange("7d", now).from).toBe(new Date(2026, 9, 4, 0, 0, 0, 0).toISOString());
    expect(presetRange("90d", now).from).toBe(new Date(2026, 6, 13, 0, 0, 0, 0).toISOString());
  });

  it("ends every preset at now so the previous period spans the same time", () => {
    for (const preset of ["today", "7d", "30d", "90d"] as const) {
      expect(presetRange(preset, now).to).toBe(now.toISOString());
    }
  });
});

describe("trendPercent", () => {
  it("compares with the previous period", () => {
    expect(trendPercent(110, 100)).toBe(10);
    expect(trendPercent(90, 100)).toBe(-10);
    expect(trendPercent(0, 0)).toBe(0);
  });

  it("has no percentage when the previous period was zero", () => {
    expect(trendPercent(5, 0)).toBeNull();
  });
});

describe("formatPercent", () => {
  it("rounds to whole percent, keeping a decimal under 10%", () => {
    expect(formatPercent(2 / 3)).toBe("67%");
    expect(formatPercent(0.05)).toBe("5.0%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("pointValue", () => {
  const point: SeriesPoint = { bucket: "", visitors: 4, pageViews: 9, sessions: 4, bounced: 1, orders: 1, revenue: 800 };

  it("derives bounce and conversion rates per bucket", () => {
    expect(pointValue(point, "bounceRate")).toBe(0.25);
    expect(pointValue(point, "conversionRate")).toBe(0.25);
    expect(pointValue(point, "revenue")).toBe(800);
  });

  it("returns 0 rather than NaN for empty buckets", () => {
    const empty = { ...point, visitors: 0, sessions: 0, bounced: 0, orders: 0 };
    expect(pointValue(empty, "bounceRate")).toBe(0);
    expect(pointValue(empty, "conversionRate")).toBe(0);
  });
});

describe("bucketLabel", () => {
  it("labels hours, days and months", () => {
    expect(bucketLabel("2026-10-10T14:00:00", "hour")).toBe("14:00");
    expect(bucketLabel("2026-10-03T00:00:00", "day")).toBe("Oct 3");
    expect(bucketLabel("2026-10-01T00:00:00", "month")).toBe("Oct 2026");
  });
});

describe("keyLabel / filterValueLabel", () => {
  it("names empty values by dimension", () => {
    expect(keyLabel("referrer", null)).toBe("Direct");
    expect(keyLabel("utmSource", null)).toBe("(not set)");
    expect(keyLabel("country", null)).toBe("Unknown");
    expect(keyLabel("path", "/shop")).toBe("/shop");
    expect(filterValueLabel("referrer", NONE)).toBe("Direct");
    expect(filterValueLabel("referrer", "youtube.com")).toBe("youtube.com");
  });
});
