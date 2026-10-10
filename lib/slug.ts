/**
 * Product URL slug: name + SKU, e.g. "premium-comforter-5-pcs-set-xan02w".
 *
 * Two identically-named products ("category-wise product name is the same"
 * across this catalog) would collide on a name-only slug — the SKU
 * (products.sku, unique + required) is what actually makes it unique.
 * Generated once at product creation and stored on products.slug; never
 * recomputed on later edits, so a product's URL survives a rename the same
 * way its id always has.
 */
export function buildProductSlug(name: string, sku: string): string {
  const namePart = slugifyPart(name);
  const skuPart = slugifyPart(sku);
  return skuPart ? `${namePart}-${skuPart}` : namePart;
}

function slugifyPart(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
