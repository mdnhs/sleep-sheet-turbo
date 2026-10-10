import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import ProductCard from "@/components/product/product-card";
import ProductVideosLazy from "@/features/product/components/product-videos-lazy";
import { productVideoPoster, productVideoUrl } from "@/lib/product-video";
import ProductPicker from "@/features/product/components/product-picker";
import { ProductAccordion } from "@/features/product/components/product-accordion";
import { ProductPolicyAccordion } from "@/features/product/components/product-policy-accordion";
import ProductReviews from "@/features/product/components/product-reviews-lazy";
import ProductTag from "@/features/product/components/product-tags";
import SwitchImage from "@/features/product/components/switch-image";
import { ProductViewTracker } from "@/features/product/components/product-view-tracker";
import { getAllProductSlugs, getProductBySlug } from "@/features/product/server/get-product";
import {
  seoConfig,
  generateProductMetadata,
  productSchema,
  breadcrumbSchema,
  videoObjectSchema,
  structuredDataScript,
} from "@/lib/seo";
import { seoStore } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import { proseTableClasses } from "@/lib/prose-table-classes";

type Props = { params: Promise<{ slug: string }> };

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The description HTML opens with an <h2> that repeats the product name, so a
// plain strip made every meta description start with "🛌 <name>" — the same
// words as the <title>, wasting half of Google's ~160-char snippet. Drop that
// leading heading and any leading emoji so the snippet opens with the
// design-specific intro.
function metaDescription(html: string): string {
  return stripHtml(html.replace(/^\s*<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/i, "")).replace(/^[^\p{L}\p{N}]+/u, "");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  const store = await seoStore();

  return generateProductMetadata(
    {
      name: product.name,
      description: metaDescription(product.description || ""),
      slug: product.slug,
      images: product.images,
      price: product.price,
      rating: product.rating,
      reviewCount: product.reviewCount,
    },
    store,
  );
}

import { getPublicProductList, getPublicProductVideos, getPublicProducts, getPublicSettings } from "@/lib/prefetch-home";
import { SHIPPING_ZONES } from "@/features/checkout/constants";

// Cached with ISR for 24 hours at Vercel Edge CDN.
// The "products" cache tag already invalidates when products or stock are updated in the dashboard.
export const revalidate = 86400;

// `revalidate` alone never made this route ISR: per the generateStaticParams
// docs, a dynamic segment only revalidates (instead of rendering per request)
// once the route exports generateStaticParams — so every product view was a
// function invocation plus a server render, and the build's prerender
// manifest listed no /shop/* pages at all. Prerendering every slug at build
// also means a fresh deploy serves its product pages from the edge cache
// straight away; a slug added after the build (dynamicParams defaults to
// true) renders on its first visit and is cached from then on. A failed slug
// query falls back to exactly that, rather than failing the build.
export async function generateStaticParams() {
  const slugs = await getAllProductSlugs().catch(() => []);
  return slugs.map((slug) => ({ slug }));
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const store = await getStoreProfile();
  // React cache() memoizes getProductBySlug between generateMetadata and page render.
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Parallel fetch: all related data fetches run concurrently without waterfalls
  const [relatedProductsRes, settings, videosRes, sameCategoryRes] = await Promise.all([
    getPublicProducts().catch(() => null),
    // The cached, "settings"-tagged public map (both layouts already read it,
    // so this is a warm hit). getSettingsMap() was a direct Neon query behind
    // only a 60s in-process TTL — run on most product views, and untagged, so
    // a shipping-rate edit wouldn't have refreshed the cached page either.
    getPublicSettings().catch(() => ({} as Record<string, string>)),
    getPublicProductVideos().catch(() => null),
    product.category
      ? getPublicProductList({ category: product.category }).catch(() => null)
      : Promise.resolve(null),
  ]);

  // The price the page shows first: product-picker.tsx preselects the
  // default variant, so the structured-data price has to match it —
  // Google flags a schema price that differs from the visible one.
  const schemaPrice =
    product.colors?.find((c) => c.name === product.defaultVariantName)?.price ?? product.price;
  // Same settings (and fallbacks) checkout bills from — see
  // getShippingCost in features/checkout/server/route.ts.
  const shippingRates = {
    insideDhaka: Number(settings.shipping_inside_dhaka ?? SHIPPING_ZONES.inside_dhaka.cost),
    outsideDhaka: Number(settings.shipping_outside_dhaka ?? SHIPPING_ZONES.outside_dhaka.cost),
  };

  const sameCategory = sameCategoryRes?.data ?? [];
  const seen = new Set([product.id]);
  // Only the fields the carousel and the viewer read (no description or
  // uploadDate): everything passed to a client component is serialized into
  // the page's HTML.
  const otherVideos = (videosRes?.data ?? [])
    .filter((v) => v.id !== product.id)
    .map(({ id, slug, name, price, discount, defaultVariantName, colors, video, likes }) => ({
      id, slug, name, price, discount, defaultVariantName, colors, video, likes,
    }));

  const relatedProducts = [...sameCategory, ...(relatedProductsRes?.data ?? [])]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .slice(0, 8);

  const categoryLabel = product.categoryLabel || product.category || "Products";
  const productBreadcrumbs = [
    { name: "Home", url: "/" },
    { name: categoryLabel, url: `/categories/${product.category}` },
    { name: product.name, url: `/shop/${product.slug}` },
  ];

  return (
    <div className="bg-[#F4F4F4] dark:bg-gray-800 min-h-screen pb-24 lg:pb-8">
      <ProductViewTracker product={product} />
      {structuredDataScript(
        "product",
        productSchema({
          id: product.id,
          name: product.name,
          description: stripHtml(product.description || ""),
          slug: product.slug,
          price: schemaPrice,
          currency: "BDT",
          sku: product.sku,
          category: product.category,
          images: product.images,
          rating: product.rating,
          reviewCount: product.reviewCount,
          availability: product.stock > 0 ? "InStock" : "OutOfStock",
          url: `${seoConfig.siteUrl}/shop/${product.slug}`,
          brand: store.name,
          sellerName: store.name,
          shippingRates,
          // The first page of reviews, the same ones product-reviews renders
          // from this product object on load.
          reviews: product.reviews.map((r) => ({
            author: r.name,
            rating: r.rating,
            body: r.comment,
            date: r.date,
          })),
        }),
      )}
      {product.video &&
        structuredDataScript(
          "product-video",
          videoObjectSchema(
            `${product.name} – video`,
            stripHtml(product.description || "") || product.name,
            productVideoPoster(product.video),
            productVideoUrl(product.video),
            product.updatedAt,
          ),
        )}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema(productBreadcrumbs),
      )}
      {product.video && (
        // The page opens on the video. Its poster isn't the LCP element (the
        // blurred full-frame backdrop in SwitchImage is, and that carries its
        // own high-priority preload), but it is the frame visitors look at
        // until playback starts, so it is still fetched early — at the default
        // priority, behind the LCP image.
        // For non-video products, Next.js's `<Image priority fetchPriority="high">` inside SwitchImage
        // automatically outputs the exact responsive transformed preload tag.
        // Width must match the poster SwitchImage renders (640), or the
        // preloaded file is never used and the browser downloads both.
        <link rel="preload" as="image" href={productVideoPoster(product.video, 640)} />
      )}
      <div className="container mx-auto px-4 py-2 lg:py-4">
        <nav
          aria-label="Breadcrumb"
          className="hidden lg:flex items-center gap-3 mb-3 text-xs text-muted-foreground font-medium"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <span className="mx-2 text-border">•</span>
          <Link
            href={`/categories/${product.category}`}
            className="hover:text-foreground transition-colors"
          >
            {categoryLabel}
          </Link>
          <span className="mx-2 text-border">•</span>
          <span className="text-foreground" aria-current="page">
            {product.name}
          </span>
        </nav>

        <article className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-6 items-start">
          {/* Left Column - Part 1: Media / Gallery (Row 1 on desktop, 1st on mobile) */}
          <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
            <SwitchImage product={product} />
          </div>

          {/* Right Column: Product Info & Picker (Row 1-2 on desktop sticky, 2nd on mobile) */}
          <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-4 self-start min-w-0">
            <div>
              <div className="min-w-0 mb-1.5 lg:mb-2">
                <h1
                  className="font-heading text-lg sm:text-xl lg:text-4xl font-semibold tracking-tight text-foreground truncate"
                  title={product.name}
                >
                  {product.name}
                </h1>
              </div>

              {product.reviewCount && product.reviewCount > 0 ? (
                <a
                  href="#product-reviews"
                  className="flex w-fit items-center gap-2 mb-2 lg:mb-3 group cursor-pointer hover:opacity-85 transition-opacity"
                >
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.round(product.rating || 0)
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-slate-300 dark:text-slate-600 fill-slate-300 dark:fill-slate-600"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {product.rating?.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground group-hover:underline">
                    ({product.reviewCount} customer {product.reviewCount === 1 ? "review" : "reviews"})
                  </span>
                </a>
              ) : null}

              <ProductPicker product={product} />

              {/* The landing page's video carousel, reused. This product's own
                  video is already the gallery's first slide, so it's left out. */}
              {otherVideos.length > 0 && (
                <div className="mt-3">
                  <ProductVideosLazy items={otherVideos} />
                </div>
              )}

              <div className="mt-3">
                <ProductAccordion product={product} />
              </div>
            </div>
          </div>

          {/* Left Column - Part 2: Description, Features, Specs, Policies (Row 2 on desktop under media, 3rd on mobile) */}
          <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2 space-y-4 mt-2 lg:mt-0">
            {/* Description */}
            {product.description && (
              <section className="bg-white dark:bg-slate-900 p-5 md:p-8 rounded-3xl">
                <h2 className="text-xl font-bold text-foreground mb-4">
                  Description & Fit
                </h2>
                <div
                  className={`prose prose-sm md:prose-base dark:prose-invert text-muted-foreground leading-relaxed max-w-none ${proseTableClasses}`}
                  dangerouslySetInnerHTML={{ __html: product.description || "" }}
                />
              </section>
            )}

            {/* Product Features */}
            {product.features && product.features.length > 0 && (
              <div className="bg-white dark:bg-slate-900 p-5 md:p-8 rounded-3xl">
                <h2 className="text-xl font-bold text-foreground mb-4">
                  Product Features
                </h2>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 list-disc pl-5 text-muted-foreground text-sm">
                  {product.features.map((feature, i) => (
                    <li key={i} className="leading-relaxed">
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specifications */}
            {product.specifications && product.specifications.length > 0 && (
              <div className="bg-secondary/10 rounded-3xl p-5 md:p-8">
                <h2 className="text-xl font-bold text-foreground mb-4">
                  Specifications
                </h2>
                <div className="overflow-x-auto rounded-xl border border-border/40">
                  <table className="w-full text-sm">
                    <tbody className="bg-white dark:bg-card divide-y divide-border/40">
                      {product.specifications.map((spec, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 font-semibold text-foreground w-1/3 leading-normal">
                            {spec.key}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground leading-normal">
                            {spec.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-3xl">
                <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
                  Product Tags
                </h2>
                <ProductTag tags={product.tags} />
              </div>
            )}

            {/* Policy Accordion */}
            <div>
              <ProductPolicyAccordion />
            </div>
          </div>
        </article>

        {/* Reviews Section */}
        <div id="product-reviews" className="scroll-mt-10">
          <ProductReviews product={product} />
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section
          aria-label="Related products"
          className="mt-3 pt-3 pb-6 bg-white dark:bg-slate-900 border-t border-border/50"
        >
          <div className="container mx-auto px-4">
            <h2 className="mb-3 text-3xl md:text-4xl font-semibold text-center text-foreground tracking-tight">
              You might also like
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              {relatedProducts.map((related) => (
                <ProductCard key={related.id} product={related} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
