"use client"
import { useEffect, useState } from "react"
import { useQueryState, parseAsString, parseAsInteger } from "nuqs"
import type { ColumnDef, PaginationState, Updater } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/dashboard/skeletons"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { MoreVertical, Plus, Search, Trash2, Loader2, EyeOff, CheckCircle } from "lucide-react"
import { useGetPosts } from "@/features/blog/api/use-get-posts"
import { useDeletePost } from "@/features/blog/api/use-delete-post"
import { useBulkDeletePosts } from "@/features/blog/api/use-bulk-delete-posts"
import { useTogglePublish } from "@/features/blog/api/use-toggle-publish"
import Link from "next/link"

export type BlogColumn = {
  id: string
  title: string
  slug: string
  summary: string | null
  isPublished: boolean
  createdAt: string
  author: { id: string; name: string } | null
}

export default function BlogClientPage() {
  const { mutate: deletePost, isPending: isDeleting } = useDeletePost()
  const { mutate: bulkDelete, isPending: isBulkDeleting } = useBulkDeletePosts()
  const {
    mutate: togglePublish,
    isPending: isTogglingPublish,
    variables: togglingVariables,
  } = useTogglePublish()
  const [postToDelete, setPostToDelete] = useState<BlogColumn | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const [searchQuery, setSearchQuery] = useQueryState("search", parseAsString.withDefault(""))
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1))
  const [limit, setLimit] = useQueryState("limit", parseAsInteger.withDefault(10))
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  const pagination: PaginationState = {
    pageIndex: Math.max(0, page - 1),
    pageSize: limit,
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const { data: postsData, isLoading } = useGetPosts({
    page: page.toString(),
    search: debouncedSearch,
    limit: limit.toString(),
  })

  const handleBulkDelete = () => {
    const ids = (postsData?.data ?? [])
      .filter((_: unknown, index: number) => rowSelection[index.toString()])
      .map((p: BlogColumn) => p.id)
    if (ids.length === 0) return
    bulkDelete(ids, {
      onSuccess: () => {
        setRowSelection({})
        setConfirmBulkDelete(false)
      },
      onError: () => setConfirmBulkDelete(false),
    })
  }

  const columns: ColumnDef<BlogColumn>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(value) => table.toggleAllPageRowsSelected(!!value.target.checked)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={row.getIsSelected()}
          onChange={(value) => row.toggleSelected(!!value.target.checked)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium line-clamp-1">{row.original.title}</span>
          <span className="text-xs text-muted-foreground">/{row.original.slug}</span>
        </div>
      ),
    },
    {
      accessorKey: "author",
      header: "Author",
      cell: ({ row }) => row.original.author?.name || "—",
    },
    {
      accessorKey: "isPublished",
      header: "Status",
      cell: ({ row }) => {
        const post = row.original
        // The mutation is shared across rows, so scope the pending state to the row
        // actually in flight — otherwise every switch would disable at once.
        const isToggling = isTogglingPublish && togglingVariables?.id === post.id

        return (
          <div className="flex items-center gap-2">
            <Switch
              size="sm"
              checked={post.isPublished}
              disabled={isToggling}
              onCheckedChange={(checked: boolean) =>
                togglePublish({ id: post.id, isPublished: checked })
              }
              aria-label={
                post.isPublished
                  ? `Unpublish ${post.title}`
                  : `Publish ${post.title}`
              }
            />
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap",
                post.isPublished ? "text-green-600" : "text-amber-600"
              )}
            >
              {isToggling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : post.isPublished ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              {post.isPublished ? "Published" : "Draft"}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: "Date Added",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      enableHiding: false,
      cell: ({ row }) => {
        const post = row.original
        return (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href={`/dashboard/blog/update/${post.id}`}>
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                </Link>
                <Link href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                  <DropdownMenuItem>View Blog</DropdownMenuItem>
                </Link>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={isDeleting}
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => setPostToDelete(post)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value || null)
    setPage(1)
  }

  const selectedCount = Object.keys(rowSelection).length

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-40 rounded-xl mb-2" />
            <Skeleton className="h-4 w-64 rounded-xl" />
          </div>
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
        <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
          <Skeleton className="h-10 w-full sm:max-w-sm rounded-full" />
          <TableSkeleton rows={10} cols={5} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blog Posts</h1>
          <p className="text-muted-foreground text-sm">Create, manage, and publish articles and news</p>
        </div>
        <Link href="/dashboard/blog/create">
          <Button className="gap-2 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap rounded-full px-5 h-9 text-xs font-semibold">
            <Plus className="h-4 w-4" />
            Create Post
          </Button>
        </Link>
      </div>

      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
        <DataTable<BlogColumn, unknown>
          columns={columns}
          data={postsData?.data ?? []}
          manualPagination
          pageCount={postsData?.totalPages ?? -1}
          pagination={pagination}
          onPaginationChange={(updater: Updater<PaginationState>) => {
            const next = typeof updater === "function" ? updater(pagination) : updater
            setPage(next.pageIndex + 1)
            setLimit(next.pageSize)
          }}
          rowSelection={rowSelection}
          onRowSelectionChange={(updater: Updater<Record<string, boolean>>) => {
            setRowSelection(typeof updater === "function" ? updater(rowSelection) : updater)
          }}
          searchSlot={
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value || null)
                    setPage(1)
                  }}
                  className="pl-9 w-full rounded-full text-xs font-semibold"
                />
              </div>
              {selectedCount > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{selectedCount} selected</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5 rounded-full text-xs font-semibold"
                    onClick={() => setConfirmBulkDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          }
        />
      </div>

      <AlertDialog open={!!postToDelete} onOpenChange={(open) => !open && setPostToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{postToDelete?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => {
                if (postToDelete) {
                  deletePost(postToDelete.id, { onSuccess: () => setPostToDelete(null) })
                }
              }}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Posts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} selected posts? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isBulkDeleting}
              onClick={handleBulkDelete}
            >
              {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
