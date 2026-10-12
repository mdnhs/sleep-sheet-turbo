"use client"
import { useEffect, useState, useRef } from "react"
import { useQueryState, parseAsString, parseAsInteger } from "nuqs"
import type { ColumnDef, PaginationState, Updater } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
import { cn } from "@/lib/utils"
import { MoreVertical, Search, Trash2, Loader2, Star, ImageIcon, Plus, X, ImagePlus } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { useGetTestimonials } from "@/features/testimonials/api/use-get-testimonials"
import { useCreateTestimonial } from "@/features/testimonials/api/use-create-testimonial"
import { useDeleteTestimonial } from "@/features/testimonials/api/use-delete-testimonial"
import { useBulkDeleteTestimonials } from "@/features/testimonials/api/use-bulk-delete-testimonials"
import { useUpdateTestimonial } from "@/features/testimonials/api/use-update-testimonial"

export type TestimonialColumn = {
  id: string
  name: string
  message: string
  rating: number
  role: string
  screenshot: string | null
  createdAt: string
}

const roleLabel: Record<string, string> = {
  FASHION_ENTHUSIAST: "Fashion Enthusiast",
  CUSTOMER: "Customer",
  INFLUENCER: "Influencer",
  OTHER: "Other",
}

export default function TestimonialsClientPage() {
  const { mutate: deleteTestimonial, isPending: isDeleting } = useDeleteTestimonial()
  const { mutate: bulkDelete, isPending: isBulkDeleting } = useBulkDeleteTestimonials()
  const { mutate: updateTestimonial, isPending: isUpdating } = useUpdateTestimonial()
  
  const [testimonialToDelete, setTestimonialToDelete] = useState<TestimonialColumn | null>(null)
  const [testimonialToEdit, setTestimonialToEdit] = useState<TestimonialColumn | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const { mutate: createTestimonial, isPending: isCreating } = useCreateTestimonial()
  
  const [createOpen, setCreateOpen] = useState(false)
  const [testimonialName, setTestimonialName] = useState("")
  const [testimonialMessage, setTestimonialMessage] = useState("")
  const [testimonialRating, setTestimonialRating] = useState(5)
  const [testimonialRole, setTestimonialRole] = useState("CUSTOMER")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const { data: testimonials, isLoading } = useGetTestimonials({
    page: page.toString(),
    search: debouncedSearch,
    limit: limit.toString(),
  })

  const handleBulkDelete = () => {
    const ids = (testimonials?.data ?? [])
      .filter((_: unknown, index: number) => rowSelection[index.toString()])
      .map((t: TestimonialColumn) => t.id)
    if (ids.length === 0) return
    bulkDelete(ids, {
      onSuccess: () => {
        setRowSelection({})
        setConfirmBulkDelete(false)
      },
      onError: () => setConfirmBulkDelete(false),
    })
  }

  const handleImageSelect = (file: File) => {
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("image", imageFile)
      const res = await fetch("/api/testimonials/upload-image", { method: "POST", body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error((json as { error?: string }).error || "Upload failed")
      return (json as { url: string }).url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload image")
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalImage = await uploadImage()
    if (imageFile && !finalImage) return

    createTestimonial(
      { 
        name: testimonialName, 
        message: testimonialMessage, 
        rating: testimonialRating, 
        role: testimonialRole as "FASHION_ENTHUSIAST" | "CUSTOMER" | "INFLUENCER" | "OTHER",
        screenshot: finalImage ?? undefined 
      },
      {
        onSuccess: () => {
          setTestimonialName("")
          setTestimonialMessage("")
          setTestimonialRating(5)
          setTestimonialRole("CUSTOMER")
          setImageFile(null)
          setImagePreview("")
          setCreateOpen(false)
        },
      }
    )
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testimonialToEdit) return

    let finalImage = testimonialToEdit.screenshot
    if (imageFile) {
      const uploaded = await uploadImage()
      if (!uploaded) return
      finalImage = uploaded
    }

    updateTestimonial(
      { 
        id: testimonialToEdit.id,
        json: {
          name: testimonialName, 
          message: testimonialMessage, 
          rating: testimonialRating, 
          role: testimonialRole as "FASHION_ENTHUSIAST" | "CUSTOMER" | "INFLUENCER" | "OTHER",
          screenshot: finalImage ?? undefined 
        }
      },
      {
        onSuccess: () => {
          setTestimonialName("")
          setTestimonialMessage("")
          setTestimonialRating(5)
          setTestimonialRole("CUSTOMER")
          setImageFile(null)
          setImagePreview("")
          setEditOpen(false)
          setTestimonialToEdit(null)
        },
      }
    )
  }

  const openEditModal = (testimonial: TestimonialColumn) => {
    setTestimonialToEdit(testimonial)
    setTestimonialName(testimonial.name || "")
    setTestimonialMessage(testimonial.message || "")
    setTestimonialRating(testimonial.rating || 5)
    setTestimonialRole(testimonial.role || "CUSTOMER")
    setImageFile(null)
    setImagePreview(testimonial.screenshot || "")
    setEditOpen(true)
  }

  const columns: ColumnDef<TestimonialColumn>[] = [
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
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "message",
      header: "Message",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm line-clamp-2 max-w-xs">
          {row.original.message || <span className="italic">Screenshot only</span>}
        </span>
      ),
    },
    {
      accessorKey: "rating",
      header: "Rating",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span>{row.original.rating}/5</span>
        </div>
      ),
    },
    {
      accessorKey: "screenshot",
      header: "Screenshot",
      cell: ({ row }) =>
        row.original.screenshot ? (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <span className="text-muted-foreground/50 text-sm">—</span>
        ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => roleLabel[row.original.role] || row.original.role,
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
        const testimonial = row.original
        return (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    openEditModal(testimonial)
                  }}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={isDeleting}
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => setTestimonialToDelete(testimonial)}
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
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
        <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
          <Skeleton className="h-10 w-full sm:max-w-sm rounded-full" />
          <TableSkeleton rows={10} cols={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Testimonials</h1>
          <p className="text-muted-foreground text-sm">Manage customer feedback, reviews, and testimonials</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className={cn(buttonVariants(), "gap-2 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap rounded-full px-5 h-9 text-xs font-semibold")}>
            <Plus className="h-4 w-4" />
            Add Testimonial
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Testimonial</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Name</label>
                <Input
                  placeholder="Reviewer Name (Optional)"
                  value={testimonialName}
                  onChange={(e) => setTestimonialName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Message</label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                  placeholder="Testimonial message (Optional)"
                  value={testimonialMessage}
                  onChange={(e) => setTestimonialMessage(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Rating (1-5)</label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={testimonialRating}
                    onChange={(e) => setTestimonialRating(parseInt(e.target.value) || 5)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Role</label>
                  <select
                    value={testimonialRole}
                    onChange={(e) => setTestimonialRole(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="FASHION_ENTHUSIAST">Fashion Enthusiast</option>
                    <option value="INFLUENCER">Influencer</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Screenshot / Image</label>
                <div className="flex items-start gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImageSelect(file)
                    }}
                  />
                  {imagePreview ? (
                    <div className="relative h-20 w-20 rounded-lg overflow-hidden border">
                      <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/80 flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-20 w-20 rounded-lg border-2 border-dashed border-input flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:border-foreground/50 transition-colors"
                    >
                      <ImagePlus className="h-5 w-5" />
                      Upload
                    </button>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isCreating || isUploading}>
                {(isCreating || isUploading) ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {isUploading ? "Uploading..." : "Creating..."}</>
                ) : (
                  "Create Testimonial"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
        <DataTable<TestimonialColumn, unknown>
          columns={columns}
          data={testimonials?.data ?? []}
          manualPagination
          pageCount={testimonials?.totalPages ?? -1}
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
                  placeholder="Search testimonials..."
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

      <AlertDialog open={!!testimonialToDelete} onOpenChange={(open) => !open && setTestimonialToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Testimonial</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the testimonial from &quot;{testimonialToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => {
                if (testimonialToDelete) {
                  deleteTestimonial(testimonialToDelete.id, { onSuccess: () => setTestimonialToDelete(null) })
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
            <AlertDialogTitle>Delete Selected Testimonials</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} selected testimonials? This action cannot be undone.
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

      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open)
        if (!open) setTestimonialToEdit(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Testimonial</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Name</label>
              <Input
                placeholder="Reviewer Name (Optional)"
                value={testimonialName}
                onChange={(e) => setTestimonialName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Message</label>
              <textarea
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                placeholder="Testimonial message (Optional)"
                value={testimonialMessage}
                onChange={(e) => setTestimonialMessage(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Rating (1-5)</label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={testimonialRating}
                  onChange={(e) => setTestimonialRating(parseInt(e.target.value) || 5)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Role</label>
                <select
                  value={testimonialRole}
                  onChange={(e) => setTestimonialRole(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="FASHION_ENTHUSIAST">Fashion Enthusiast</option>
                  <option value="INFLUENCER">Influencer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Image</label>
              <div className="flex items-start gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageSelect(file)
                  }}
                />
                {imagePreview ? (
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden border">
                    <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/80 flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-20 w-20 rounded-lg border-2 border-dashed border-input flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:border-foreground/50 transition-colors"
                  >
                    <ImagePlus className="h-5 w-5" />
                    Upload
                  </button>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isUpdating || isUploading}>
              {(isUpdating || isUploading) ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isUploading ? "Uploading..." : "Updating..."}</>
              ) : (
                "Update Testimonial"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
