import { ProductFormSkeleton } from "@/components/dashboard/skeletons"

// Same 2/3 + 1/3 card layout as the create page, not FormPageSkeleton's
// generic single-column form.
export default function Loading() {
  return <ProductFormSkeleton />
}
