// The storefront's dynamic routes (app/(client)/**/[param]). A path under one
// of these prefixes with exactly one more segment collapses to the pattern, so
// every product page counts as one "/shop/[slug]" row in the Routes panel.
const PATTERNS: ReadonlyArray<{ prefix: string; pattern: string }> = [
  { prefix: "/shop/", pattern: "/shop/[slug]" },
  { prefix: "/blog/", pattern: "/blog/[slug]" },
  { prefix: "/categories/", pattern: "/categories/[value]" },
  { prefix: "/videos/share/", pattern: "/videos/share/[slug]" },
  { prefix: "/orders/", pattern: "/orders/[orderId]" },
];

export function toRoute(path: string): string {
  const clean = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  for (const { prefix, pattern } of PATTERNS) {
    if (!clean.startsWith(prefix)) continue;
    const rest = clean.slice(prefix.length);
    if (rest && !rest.includes("/")) return pattern;
  }
  return clean;
}
