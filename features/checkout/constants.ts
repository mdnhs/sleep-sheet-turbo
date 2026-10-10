// Kept free of zod on purpose. hooks/use-website-settings.ts runs in the
// storefront layout on every page, and reading these through ./schema pulled
// zod — including every one of its ~50 locale bundles, ~290KB of JS — into the
// client code every page downloads and parses. ./schema re-exports both, so
// its existing importers are unaffected.
export const SHIPPING_ZONES = {
  inside_dhaka: { label: "Inside Dhaka", cost: 60 },
  outside_dhaka: { label: "Outside Dhaka", cost: 120 },
} as const;

export type ShippingZone = keyof typeof SHIPPING_ZONES;
