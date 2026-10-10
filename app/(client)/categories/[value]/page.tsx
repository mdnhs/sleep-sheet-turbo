import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { marked } from "marked";
import ProductContents from "@/features/product/components/product-contents";
import ProductGridFallback from "@/features/product/components/product-grid-fallback";
import ProductSidebar, { ProductSidebarSkeleton } from "@/features/product/components/products-sidebar";
import { getCategoryByValue, getCategoryProductsPreview } from "@/features/categories/server/get-category";
import {
  seoConfig,
  generateCategoryMetadata,
  collectionPageSchema,
  breadcrumbSchema,
  structuredDataScript,
} from "@/lib/seo";
import { proseTableClasses } from "@/lib/prose-table-classes";
import { getPublicProductList } from "@/lib/prefetch-home";

// Cached with ISR for 24 hours at Vercel Edge CDN.
// The "categories" and "products" tags invalidate when edited in the dashboard.
export const revalidate = 86400;

type Props = { params: Promise<{ value: string }> };

// seoTitle is admin-entered and some already end in "| Sleep Sheet" — the
// metadata helper appends the site name itself, so strip it here to avoid
// "… | Sleep Sheet | Sleep Sheet" in the <title>.
function categoryTitle(category: { seoTitle: string | null; label: string }): string {
  return (category.seoTitle || category.label).replace(/\s*\|\s*sleep\s*sheet.*$/i, "").trim() || category.label;
}

// Visible H1: the keyword part of the SEO title (before the first " — ",
// " - " or " | "), e.g. "Comforter Price in Bangladesh", so the heading
// carries the search phrase instead of just the bare category label.
function categoryHeading(category: { seoTitle: string | null; label: string }): string {
  return categoryTitle(category).split(/\s+[—–|-]\s+/)[0].trim() || category.label;
}

function categoryDescription(label: string): string {
  return `Shop ${label} online in Bangladesh at ${seoConfig.siteName}. 100% twill cotton fabric, cash on delivery, home delivery all over Bangladesh.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { value } = await params;
  const category = await getCategoryByValue(value);
  if (!category) return { title: "Category not found" };

  // An empty category is a thin page Google treats as a soft 404 — keep it
  // out of the index until it has products (it's also left out of the
  // categories sitemap, see lib/seo/sitemap.ts).
  const hasProducts =
    (await getCategoryProductsPreview([category.id, ...category.children.map((c) => c.id)], 1)).length > 0;

  return generateCategoryMetadata({
    noIndex: !hasProducts,
    // Custom copy (written per-category in the dashboard) wins over the
    // generic auto-generated sentence, same idea as competitor category
    // pages that hand-write unique title/description instead of templating.
    name: categoryTitle(category),
    description: category.seoDescription || categoryDescription(category.label),
    slug: category.value,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { value } = await params;
  const category = await getCategoryByValue(value);
  if (!category) notFound();

  const categoryIds = [category.id, ...category.children.map((c) => c.id)];
  const [previewProducts, initialProducts] = await Promise.all([
    getCategoryProductsPreview(categoryIds),
    getPublicProductList({ category: category.label }).catch(() => null),
  ]);

  const categoryUrl = `${seoConfig.siteUrl}/categories/${category.value}`;
  const description = category.seoDescription || categoryDescription(category.label);

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: category.label, url: `/categories/${category.value}` },
  ];

  return (
    <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
      <div className="container mx-auto py-4 px-4 min-h-[80vh]">
        {structuredDataScript(
          "collection-page",
          collectionPageSchema(
            category.label,
            description,
            categoryUrl,
            previewProducts.map((p) => ({
              name: p.name,
              url: `${seoConfig.siteUrl}/shop/${p.slug || p.id}`,
              image: p.images?.[0],
            })),
          ),
        )}
        {structuredDataScript("breadcrumbs", breadcrumbSchema(breadcrumbs))}

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-4 text-xs text-muted-foreground font-medium">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span className="text-border">•</span>
          <span className="text-foreground" aria-current="page">{category.label}</span>
        </nav>

        <h1 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight text-foreground mb-6">
          {categoryHeading(category)}{" "}
          <span className="text-muted-foreground text-base font-normal">({category.productCount})</span>
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <Suspense fallback={<ProductSidebarSkeleton />}>
            <ProductSidebar initialCategory={category.label} />
          </Suspense>

          <div className="flex-1 w-full">
            <Suspense fallback={<ProductGridFallback products={initialProducts?.data} />}>
              <ProductContents initialCategory={category.label} initialProducts={initialProducts?.data} />
            </Suspense>
          </div>
        </div>

        {category.seoContent && (
          <div
            className={`prose prose-sm sm:prose-base dark:prose-invert max-w-none text-foreground leading-relaxed mt-10 pt-8 border-t border-border prose-headings:font-extrabold prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400 ${proseTableClasses}`}
            // seoContent is admin-authored markdown from the dashboard (same trust
            // level as blog post HTML, which is rendered the same way) — parsed
            // server-side so it's part of the initial HTML for SEO crawlers.
            dangerouslySetInnerHTML={{ __html: await marked.parse(category.seoContent) }}
          />
        )}
      </div>
    </div>
  );
}
