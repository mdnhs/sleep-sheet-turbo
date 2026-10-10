import { ProductFormSkeleton } from "@/components/dashboard/skeletons"

// Mirrors create-product-client.tsx: a plain container (not the shared
// PAGE_WRAPPER) with a 2/3 + 1/3 card layout, not FormPageSkeleton's single
// centered form column.
export default function Loading() {
  return <ProductFormSkeleton />
}
