import Image from "next/image";
import Link from "next/link";
import type { ProductSummary } from "@/lib/types";
import { floorToNearest50, getOptimizedImageUrl } from "@/lib/utils";
import { ProductGridSkeleton } from "./product-contents";

const formatBdt = (amount: number) => `৳${Math.round(amount).toLocaleString("en-US")}`;

/**
 * Server-rendered stand-in for ProductContents' Suspense boundary.
 *
 * ProductContents reads the URL through nuqs, which makes Next bail out to
 * client rendering for everything inside the boundary — so the server HTML
 * used to carry only a skeleton, and crawlers (and anyone on a slow device
 * before hydration) saw no products or product links at all. This renders the
 * same products as plain links with real names, prices and images; it is
 * swapped for the interactive grid on hydration.
 *
 * The card mirrors ProductCardSkeleton's box model (see
 * components/product/product-card-skeleton.tsx) so the swap doesn't move
 * the layout. Falls back to the skeleton when there is nothing to show.
 */
export default function ProductGridFallback({ products, storeName }: { products?: ProductSummary[]; storeName: string }) {
  const list = (products ?? []).filter((p) => p.slug);
  if (list.length === 0) return <ProductGridSkeleton />;

  return (
    <ul className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-3 list-none p-0 m-0">
      {list.map((product, index) => {
        // Same price the interactive card opens on: the default variant's.
        const price =
          product.colors?.find((c) => c.name === product.defaultVariantName)?.price ?? product.price ?? 0;
        const original =
          product.discount && product.discount > 0
            ? floorToNearest50(price / (1 - product.discount / 100))
            : null;
        const image = product.images?.[0];
        return (
          <li key={product.id} className="flex">
            <Link
              href={`/shop/${product.slug}`}
              className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white p-1.5 sm:rounded-3xl sm:p-3 dark:bg-slate-900"
            >
              <div className="relative mb-2 aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-[#f4f4f5] sm:mb-4 sm:rounded-[20px] dark:bg-slate-800">
                {image && (
                  <Image
                    src={getOptimizedImageUrl(image, 400)}
                    alt={`${product.name} – ${storeName} Bangladesh`}
                    fill
                    sizes="(max-width: 1200px) 50vw, 25vw"
                    quality={55}
                    priority={index < 4}
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col px-0.5 sm:px-1">
                <h3 className="mb-1 truncate flex-1 text-sm font-medium leading-snug text-slate-800 sm:mb-3 sm:text-[15px] dark:text-slate-200">
                  {product.name}
                </h3>
                <p className="mb-1.5 flex min-h-12 flex-col justify-end text-lg font-bold text-slate-800 sm:mb-4 sm:min-h-0 sm:h-[30px] sm:flex-row sm:items-baseline sm:gap-2 sm:text-[20px] dark:text-slate-200">
                  {original ? (
                    <span className="text-sm font-medium leading-5 text-slate-500 line-through dark:text-slate-400">
                      {formatBdt(original)}
                    </span>
                  ) : (
                    <span className="h-5 sm:hidden" aria-hidden="true" />
                  )}
                  {formatBdt(price)}
                </p>
                {/* Where the quantity + cart row appears once hydrated. */}
                <div aria-hidden="true" className="mb-1 h-10 sm:mb-4 sm:h-12" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
