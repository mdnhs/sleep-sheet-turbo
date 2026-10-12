"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSkeletonRows } from "@/hooks/use-skeleton-rows"
import { PRODUCTS_SKELETON_MAX, ProductsPageSkeleton, type ProductsView } from "./products-skeleton"

const DEFAULT_LIMIT = 10

/** client.tsx's `?view=`: "grid" by default, "duplicates", anything else is the table. */
function productsView(view: string | null): ProductsView {
  if (view === null || view === "grid") return "grid"
  return view === "duplicates" ? "duplicates" : "table"
}

/**
 * The page skeleton for `view`, drawing as many cards / rows / groups as that
 * view showed last time (client.tsx remembers them), else one page (`limit`).
 */
export function RememberedProductsSkeleton({ view, limit }: { view: ProductsView; limit: number }) {
  const pageSize = Math.min(limit, PRODUCTS_SKELETON_MAX[view])
  const count = useSkeletonRows(`products.${view}`, pageSize)
  return <ProductsPageSkeleton view={view} count={count} />
}

function ProductsUrlSkeleton() {
  const params = useSearchParams()
  const limit = parseInt(params.get("limit") ?? "", 10)
  return (
    <RememberedProductsSkeleton
      view={productsView(params.get("view"))}
      limit={Number.isNaN(limit) || limit < 1 ? DEFAULT_LIMIT : limit}
    />
  )
}

/** loading.tsx / the page's Suspense fallback: the view and page size come from the URL, as in client.tsx. */
export function ProductsRouteSkeleton() {
  return (
    // Reading the URL needs a Suspense boundary when prerendered; the default grid stands in.
    <Suspense fallback={<ProductsPageSkeleton />}>
      <ProductsUrlSkeleton />
    </Suspense>
  )
}
