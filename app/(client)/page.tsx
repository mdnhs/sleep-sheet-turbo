import BlogCarousel from "@/components/home/blog-carousel";
import Categories from "@/components/home/categories";
import FeaturedProduct from "@/components/home/featured-product";
import Hero from "@/components/home/hero";
import NarrowBanner from "@/components/home/narrow-banner";
import ProductVideos from "@/components/home/product-videos";
import SeoContent from "@/components/home/seo-content";
import SubcategoryProducts from "@/components/home/subcategory-products";
import { localBusinessSchema, seoConfig, structuredDataScript, webpageSchema } from "@/lib/seo";
import { siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";

// The hero (the LCP element) server-renders from the settings seeded in the
// (client) layout, so it appears in the initial HTML without a page-level
// prefetch. The below-the-fold product/category carousels deliberately fetch
// on the client (they already render skeletons): server-rendering them only
// moved their heavy hydration into the initial load window, spiking Total
// Blocking Time and — on mobile — delaying the hero paint. Fetching them
// after paint keeps that work off the critical path.
import { getPublicCategories, getPublicCategoryList, getPublicProductVideos, getPublicProducts, getPublicSettings } from "@/lib/prefetch-home";

async function Page() {
  const [categoriesRes, categoryList, productsRes, settings, videosRes] = await Promise.all([
    getPublicCategories().catch(() => null),
    getPublicCategoryList().catch(() => null),
    getPublicProducts().catch(() => null),
    getPublicSettings().catch(() => null),
    getPublicProductVideos().catch(() => null),
  ]);

  const categories = categoriesRes?.categories || [];
  const products = productsRes?.data || [];
  const productVideos = videosRes?.data || [];
  const store = storeProfileFromSettings(settings);
  const seo = siteSeoFromSettings(settings);

  return (
    <>
      {structuredDataScript(
        "webpage",
        webpageSchema(
          seo.title,
          seo.description,
          seoConfig.siteUrl,
          store,
        ),
      )}
      {structuredDataScript("local-business", localBusinessSchema(store))}

      {/* Page-level H1. The hero is an image slider with no heading, so this
          gives crawlers a single descriptive H1 in the server HTML. */}
      <h1 className="sr-only">{seo.title}</h1>

      <Hero />

      <Categories initialData={categories} />
      {/* Server-decided, so a store with no product videos doesn't render an
          empty section that pops in (and shifts the page) after load. */}
      {productVideos.length > 0 && <ProductVideos items={productVideos} />}
      <NarrowBanner />
      <FeaturedProduct initialData={products} />
      <SubcategoryProducts initialData={categoryList || []} />
      <BlogCarousel />
      <SeoContent />
    </>
  );
}

export default Page;
