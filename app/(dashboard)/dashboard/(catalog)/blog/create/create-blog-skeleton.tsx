import { PageTitle } from "@/components/dashboard-page-title"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Mirrors create-blog-client.tsx (and update-blog-client.tsx, same form):
// one max-w-5xl white card with Title / Slug / Summary pills, the cover-image
// dropzone, the Tiptap editor, the publish checkbox and Cancel/Save buttons.

function LabelSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3 rounded-md", className)} />
}

/** Label + rounded-full h-10 input. */
export function BlogInputFieldSkeleton({ label = "w-16" }: { label?: string }) {
  return (
    <div className="space-y-2">
      <LabelSkeleton className={label} />
      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  )
}

/** FileUpload dashed dropzone. */
export function BlogCoverImageSkeleton() {
  return (
    <div className="space-y-2">
      <LabelSkeleton className="w-20" />
      <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-700 p-6">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-4 w-48 max-w-full rounded-md" />
        <Skeleton className="h-3 w-36 max-w-full rounded-md" />
        <Skeleton className="h-3 w-24 rounded-md" />
      </div>
    </div>
  )
}

/** TiptapEditor: toolbar + min-h-75 content. */
export function BlogContentEditorSkeleton() {
  return (
    <div className="space-y-2">
      <LabelSkeleton className="w-14" />
      <div>
        <Skeleton className="h-12.5 w-full rounded-b-none rounded-t-md" />
        <Skeleton className="mt-px h-75 w-full rounded-t-none rounded-b-md" />
      </div>
    </div>
  )
}

export function BlogFormActionsSkeleton() {
  return (
    <>
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-28 rounded-md" />
      </div>
      <div className="flex items-center justify-end gap-3 pt-4">
        <Skeleton className="h-9 w-21 rounded-full" />
        <Skeleton className="h-9 w-27 rounded-full" />
      </div>
    </>
  )
}

export function BlogFormSkeleton() {
  return (
    <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-6">
      <div className="space-y-4">
        <BlogInputFieldSkeleton label="w-10" />
        <BlogInputFieldSkeleton label="w-16" />
        <BlogInputFieldSkeleton label="w-28" />
        <BlogCoverImageSkeleton />
        <BlogContentEditorSkeleton />
        <BlogFormActionsSkeleton />
      </div>
    </div>
  )
}

export function BlogFormPageSkeleton({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 max-w-5xl mx-auto">
      <PageTitle title={title} description={description} />
      <BlogFormSkeleton />
    </div>
  )
}

export function CreateBlogPageSkeleton() {
  return <BlogFormPageSkeleton title="Create Blog Post" description="Publish new article or announcement" />
}
