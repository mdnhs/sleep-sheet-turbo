import { BlogFormSkeleton } from "@/components/dashboard/skeletons"

// Mirrors create-blog-client.tsx: single-column form capped at max-w-5xl,
// not FormPageSkeleton's 2/3 + 1/3 split (that shape belongs to the product
// forms).
export default function Loading() {
  return <BlogFormSkeleton title="h-8 w-64" />
}
