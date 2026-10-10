/** The GA4 property to query: the tool argument, else GA4_PROPERTY_ID. Never a hardcoded store's property. */
export function resolveGa4PropertyId(
  requested: string | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  const id = requested?.trim() || env.GA4_PROPERTY_ID?.trim();
  if (!id) throw new Error("GA4 property ID missing: pass propertyId or set GA4_PROPERTY_ID");
  return id;
}
