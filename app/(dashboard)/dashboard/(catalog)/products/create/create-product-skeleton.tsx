import { PageTitle } from "@/components/dashboard-page-title"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Mirrors create-product-client.tsx (and update-product-client.tsx, which
// has the same layout): Photos card, Video card, then Product Information
// (2/3) beside Product Settings (1/3), then the sticky Clear/Publish bar.

// <Card className="w-full py-4 sm:py-6"> — Card's own ring/radius/gap.
const CARD = "flex flex-col gap-6 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 w-full py-4 sm:py-6"

function CardHeaderSkeleton({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 sm:px-6">
      <Skeleton className="size-6 rounded-md shrink-0" />
      <Skeleton className={cn("h-7 rounded-lg", title)} />
    </div>
  )
}

/** FormItem (grid gap-2): label + control. */
function FieldSkeleton({ label = "w-24", control = "h-9", className }: { label?: string; control?: string; className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Skeleton className={cn("h-3.5 rounded-md", label)} />
      <Skeleton className={cn("w-full rounded-lg", control)} />
    </div>
  )
}

/** Dashed dropzone (FileUpload / ProductVideoUpload). */
function DropzoneSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-700 p-6">
      <Skeleton className="size-8 rounded-md" />
      <Skeleton className="h-4 w-48 max-w-full rounded-md" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-36 max-w-full rounded-md" />
      ))}
    </div>
  )
}

export function ProductPhotosCardSkeleton() {
  return (
    <div className={CARD}>
      <CardHeaderSkeleton title="w-44" />
      <div className="px-4 sm:px-6">
        <DropzoneSkeleton />
      </div>
    </div>
  )
}

export function ProductVideoCardSkeleton() {
  return (
    <div className={CARD}>
      <CardHeaderSkeleton title="w-56" />
      <div className="px-4 sm:px-6">
        <DropzoneSkeleton lines={2} />
      </div>
    </div>
  )
}

/** VariantFields / AddOnFields: heading + "Add" button, then the empty-state line. */
function RepeaterSkeleton({ hint = false }: { hint?: boolean }) {
  return (
    <div className="w-full mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-1">
          <Skeleton className="h-3.5 w-16 rounded-md" />
          {hint && <Skeleton className="h-3 w-52 max-w-full rounded-md" />}
        </div>
        <Skeleton className="h-8 w-28 rounded-lg shrink-0" />
      </div>
      <Skeleton className="mt-2 h-3.5 w-32 rounded-md" />
    </div>
  )
}

export function ProductInfoCardSkeleton() {
  return (
    <div className={cn(CARD, "lg:w-2/3")}>
      <CardHeaderSkeleton title="w-52" />
      <div className="px-4 sm:px-6 space-y-3 sm:space-y-4">
        <FieldSkeleton label="w-28" />
        {/* TiptapEditor: toolbar + min-h-75 content */}
        <div className="grid gap-2">
          <Skeleton className="h-3.5 w-36 rounded-md" />
          <div>
            <Skeleton className="h-12.5 w-full rounded-b-none rounded-t-md" />
            <Skeleton className="mt-px h-75 w-full rounded-t-none rounded-b-md" />
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          <FieldSkeleton label="w-24" className="w-full" />
          <FieldSkeleton label="w-40" className="w-full" />
          <FieldSkeleton label="w-24" className="w-full" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-3.5 w-44 rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-30 rounded-lg shrink-0" />
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          <div className="w-full">
            <RepeaterSkeleton />
            <RepeaterSkeleton hint />
          </div>
          <FieldSkeleton label="w-10" control="h-12.5" className="w-full md:self-start" />
        </div>
        <FieldSkeleton label="w-32" control="h-12.5" />
        <FieldSkeleton label="w-44" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-3.5 w-60 max-w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function ProductSettingsCardSkeleton() {
  return (
    <div className={cn(CARD, "lg:w-1/3")}>
      <CardHeaderSkeleton title="w-44" />
      <div className="px-4 sm:px-6 space-y-3 sm:space-y-4">
        <FieldSkeleton label="w-16" />
        <FieldSkeleton label="w-32" control="h-12.5" />
        {/* SpecificationFields: heading + Add Field, then key/value rows */}
        <div>
          <div className="flex items-center justify-between my-4">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Skeleton className="h-9 w-1/3 rounded-lg" />
                <Skeleton className="h-9 w-2/3 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Sticky Clear / Publish bar. */
export function ProductFormActionsSkeleton() {
  return (
    <div className="sticky bottom-16 sm:bottom-0 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end mt-6 sm:mt-8 p-3 sm:p-4 -mx-3 sm:-mx-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-50">
      <Skeleton className="h-10 w-full sm:w-30 rounded-lg" />
      <Skeleton className="h-10 w-full sm:w-30 rounded-lg" />
    </div>
  )
}

/** The whole product form, shared by the create and update pages. */
export function ProductFormSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <ProductPhotosCardSkeleton />
      <ProductVideoCardSkeleton />
      <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row">
        <ProductInfoCardSkeleton />
        <ProductSettingsCardSkeleton />
      </div>
      <ProductFormActionsSkeleton />
    </div>
  )
}

/** Page wrapper of the product form pages (`container mx-auto p-3 sm:p-4`). */
export function ProductFormPageSkeleton({ title }: { title: string }) {
  return (
    <div className="container mx-auto p-3 sm:p-4">
      <PageTitle title={title} />
      <ProductFormSkeleton />
    </div>
  )
}

export function CreateProductPageSkeleton() {
  return <ProductFormPageSkeleton title="Add New Product" />
}
