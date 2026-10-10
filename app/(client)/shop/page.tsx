import ProductContents from "@/features/product/components/product-contents";
import ProductSidebar, { ProductSidebarSkeleton } from "@/features/product/components/products-sidebar";
import React, { Suspense } from "react";
import { seoConfig, generateMetadata, collectionPageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import ProductGridFallback from "@/features/product/components/product-grid-fallback";
import ShopHeader from "@/components/shop/shop-header";
import ShopSeoContent from "@/components/shop/shop-seo-content";

import { getPublicProducts, getPriceRanges } from "@/lib/prefetch-home";

export const metadata = generateMetadata({
  title: "All Products",
  description: `Shop all products online in Bangladesh at ${seoConfig.siteName}. 100% twill cotton fabric, cash on delivery, home delivery all over Bangladesh.`,
  canonical: `${seoConfig.siteUrl}/shop`,
})

async function ProductsPage() {
  const [productsRes, priceRows] = await Promise.all([
    getPublicProducts().catch(() => null),
    getPriceRanges().catch(() => []),
  ]);
  const products = productsRes?.data || [];

  return (
    <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
      <div className="container mx-auto py-1 sm:py-4 px-1.5 sm:px-4 min-h-[80vh]">
        {structuredDataScript("collection-page", collectionPageSchema(
          "All Products | " + seoConfig.siteName,
          "Browse our complete collection of premium bedding, mattresses, pillows, and sleep accessories.",
          `${seoConfig.siteUrl}/shop`,
          products.map((p) => ({
            name: p.name,
            url: `${seoConfig.siteUrl}/shop/${p.slug || p.id}`,
            image: p.images?.[0],
          })),
        ))}
        {structuredDataScript(
          "breadcrumbs",
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Shop", url: "/shop" },
          ]),
        )}

        <ShopHeader />

        {/* No gap on mobile: the sidebar is hidden there (hidden lg:block),
            but flexbox still reserves the gap between it and the content
            unless the gap itself is zeroed out below lg. */}
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-3 items-start">
          {/* Sidebar */}
          <Suspense fallback={<ProductSidebarSkeleton />}>
            <ProductSidebar />
          </Suspense>

          {/* Main Content */}
          <div className="flex-1 w-full">
            <Suspense fallback={<ProductGridFallback products={products} />}>
              <ProductContents initialProducts={products} />
            </Suspense>
          </div>
        </div>

        <ShopSeoContent priceRows={priceRows} />
      </div>
    </div>);
}

export default ProductsPage;
