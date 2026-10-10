// Breakdown dimensions and dashboard filters. Keys are the API/URL names. The
// values are analytics_events columns, and they reach SQL only through this
// fixed map, never from request input.
export const DIMENSIONS = {
  path: "path",
  route: "route",
  hostname: "hostname",
  referrer: "referrer_host",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  country: "country",
  device: "device",
  browser: "browser",
  os: "os",
} as const;

export type Dimension = keyof typeof DIMENSIONS;
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as Dimension[];
export type Filters = Partial<Record<Dimension, string>>;

/** Filter value that matches rows where the column is empty ("Direct" for referrers). */
export const NONE = "(none)";

export function activeFilters(filters: Filters): [Dimension, string][] {
  return DIMENSION_KEYS.flatMap((key) => {
    const value = filters[key];
    return value ? [[key, value] as [Dimension, string]] : [];
  });
}
