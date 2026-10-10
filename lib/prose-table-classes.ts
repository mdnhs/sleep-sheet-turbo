/**
 * Tailwind Typography (`prose`) element modifiers that make any markdown
 * table rendered inside a `.prose` block (category SEO content, blog posts,
 * product descriptions — all admin-authored markdown) match the hand-built
 * table on the shop page (components/shop/shop-seo-content.tsx): a rounded
 * bordered card, a tinted header row, and muted body text, instead of the
 * plugin's bare default table styling.
 *
 * border-separate + border-spacing-0 is required for the rounded corners to
 * actually clip — the plugin's default table CSS uses border-collapse.
 */
export const proseTableClasses =
  "prose-table:w-full prose-table:text-sm prose-table:border prose-table:border-border/40 prose-table:rounded-xl prose-table:overflow-hidden prose-table:border-separate prose-table:border-spacing-0 " +
  "prose-thead:bg-secondary/20 prose-th:px-4 prose-th:py-2.5 prose-th:font-semibold prose-th:text-foreground prose-th:text-left " +
  "prose-td:px-4 prose-td:py-2.5 prose-td:text-muted-foreground prose-td:border-t prose-td:border-border/40 " +
  "prose-td:bg-white dark:prose-td:bg-card";
