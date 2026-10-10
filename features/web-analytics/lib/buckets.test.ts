import { describe, expect, it } from "vitest";
import { bucketUnit } from "./buckets";

const day = 24 * 60 * 60 * 1000;
const start = new Date("2026-10-01T00:00:00+06:00");
const after = (ms: number) => new Date(start.getTime() + ms);

describe("bucketUnit", () => {
  it("uses hours for a day or two", () => {
    expect(bucketUnit(start, after(day - 1))).toBe("hour");
    expect(bucketUnit(start, after(2 * day))).toBe("hour");
  });

  it("uses days up to 92 days", () => {
    expect(bucketUnit(start, after(7 * day - 1))).toBe("day");
    expect(bucketUnit(start, after(90 * day - 1))).toBe("day");
    expect(bucketUnit(start, after(92 * day))).toBe("day");
  });

  it("uses months beyond that", () => {
    expect(bucketUnit(start, after(120 * day))).toBe("month");
  });
});
