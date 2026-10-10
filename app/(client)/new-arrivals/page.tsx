import ProductContents from "@/features/product/components/product-contents";
import ProductSidebar, { ProductSidebarSkeleton } from "@/features/product/components/products-sidebar";
import React, { Suspense } from "react";
import { seoConfig, collectionPageSchema, breadcrumbSchema, structuredDataScript } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import ProductGridFallback from "@/features/product/components/product-grid-fallback";
import { getPublicProductList } from "@/lib/prefetch-home";

export const generateMetadata = () =>
  pageMetadata((store) => ({
    title: "New Arrivals",
    description: `Shop new arrivals online in Bangladesh at ${store.name}. 100% twill cotton fabric, cash on delivery, home delivery all over Bangladesh.`,
    canonical: `${seoConfig.siteUrl}/new-arrivals`,
  }))

async function NewArrivalsPage() {
  const store = await getStoreProfile();
  const initialProducts = await getPublicProductList({}).catch(() => null);

  return (
    <div className="w-full bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
      <div className="container mx-auto py-4 px-4 min-h-[80vh]">
        {structuredDataScript("collection-page", collectionPageSchema(
          `New Arrivals | ${store.name}`,
          "Shop the latest comforter sets, bed sheets, and pillow covers just added.",
          `${seoConfig.siteUrl}/new-arrivals`,
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
            { name: "New Arrivals", url: "/new-arrivals" },
          ]),
        )}

        <div className="mb-4">
          <h1 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
            New Arrivals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The latest comforter sets and bed sheets, freshly added.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar */}
          <Suspense fallback={<ProductSidebarSkeleton />}>
            <ProductSidebar />
          </Suspense>

          {/* Main Content — defaults to newest-first (see products server
              route's sort=newest, which orders by createdAt desc, matching
              this page's whole purpose). */}
          <div className="flex-1 w-full">
            <Suspense fallback={<ProductGridFallback products={initialProducts?.data} />}>
              <ProductContents initialProducts={initialProducts?.data} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>);
}

export default NewArrivalsPage;
