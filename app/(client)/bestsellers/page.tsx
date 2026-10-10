import ProductContents from "@/features/product/components/product-contents";
import ProductSidebar, { ProductSidebarSkeleton } from "@/features/product/components/products-sidebar";
import React, { Suspense } from "react";
import { seoConfig, generateMetadata, collectionPageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import ProductGridFallback from "@/features/product/components/product-grid-fallback";
import { getPublicProductList } from "@/lib/prefetch-home";

export const metadata = generateMetadata({
  title: "Bestsellers",
  description: `Shop bestsellers online in Bangladesh at ${seoConfig.siteName}. 100% twill cotton fabric, cash on delivery, home delivery all over Bangladesh.`,
  canonical: `${seoConfig.siteUrl}/bestsellers`,
})

async function BestsellersPage() {
  const initialProducts = await getPublicProductList({ sort: "bestselling" }).catch(() => null);

  return (
    <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
      <div className="container mx-auto py-4 px-4 min-h-[80vh]">
        {structuredDataScript("collection-page", collectionPageSchema(
          "Bestsellers | " + seoConfig.siteName,
          "Shop our bestselling comforter sets, bed sheets, and pillow covers.",
          `${seoConfig.siteUrl}/bestsellers`,
          (initialProducts?.data ?? []).map((p) => ({
            name: p.name,
            url: `${seoConfig.siteUrl}/shop/${p.slug || p.id}`,
            image: p.images?.[0],
          })),
        ))}
        {structuredDataScript(
          "breadcrumbs",
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Bestsellers", url: "/bestsellers" },
          ]),
        )}

        <div className="mb-4">
          <h1 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
            Bestsellers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Our most-ordered comforter sets and bed sheets, ranked by real sales.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar */}
          <Suspense fallback={<ProductSidebarSkeleton />}>
            <ProductSidebar />
          </Suspense>

          {/* Main Content — defaults to sort=bestselling, ranked by total
              units sold from real, non-cancelled orders (see the
              salesSubquery in features/product/server/route.ts). */}
          <div className="flex-1 w-full">
            <Suspense fallback={<ProductGridFallback products={initialProducts?.data} />}>
              <ProductContents initialSort="bestselling" initialProducts={initialProducts?.data} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>);
}

export default BestsellersPage;
