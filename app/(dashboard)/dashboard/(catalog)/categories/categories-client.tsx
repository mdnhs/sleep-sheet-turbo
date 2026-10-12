"use client"
import { PageTitle } from "@/components/dashboard-page-title"
import { useMemo, useRef, useState } from "react"
import { useQueryState, parseAsString } from "nuqs"
import { CategoriesPageSkeleton } from "./categories-skeleton"
import { useRememberRows } from "@/hooks/use-skeleton-rows"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  FolderOpen,
  ImagePlus,
  X,
  GripVertical,
  MoreVertical,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react"
import Image from "next/image"
import { useGetCategories } from "@/features/categories/api/use-get-categories"
import { useCreateCategories } from "@/features/categories/api/use-create-categories"
import { useUpdateCategory } from "@/features/categories/api/use-update-category"
import { useDeleteCategory } from "@/features/categories/api/use-delete-category"
import { useBulkDeleteCategories } from "@/features/categories/api/use-bulk-delete-categories"
import { toast } from "sonner"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useReorderCategories } from "@/features/categories/api/use-reorder-categories"

type FlatCategory = {
  id: string
  label: string
  value: string
  parentId: string | null
  image: string | null
  order: number | null
  seoTitle?: string | null
  seoDescription?: string | null
  seoContent?: string | null
}

type CategoryRow = FlatCategory & {
  parentLabel: string
  subCount: number
}

function DraggableRow({
  row,
  selected,
  onSelect,
  onEdit,
  onDelete,
  disabled,
}: {
  row: CategoryRow
  selected: boolean
  onSelect: (checked: boolean) => void
  onEdit: () => void
  onDelete: () => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.value,
  })

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-state={isDragging ? "dragging" : selected ? "selected" : undefined}
      className={cn(
        "hover:bg-slate-50/50 dark:hover:bg-muted/40 transition-colors whitespace-nowrap border-b border-slate-100 dark:border-slate-800/60",
        isDragging && "opacity-60 shadow-lg"
      )}
    >
      <td className="w-10 px-3 py-2.5 align-middle">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <input
          type="checkbox"
          className="rounded border-input"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Select ${row.label}`}
        />
      </td>
      <td className="px-3 py-2.5 align-middle">
        {row.image ? (
          <img src={row.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 align-middle">
        <span className="font-semibold">{row.label}</span>
      </td>
      <td className="px-3 py-2.5 align-middle">
        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-slate-700 dark:text-slate-300 font-mono">{row.value}</code>
      </td>
      <td className="px-3 py-2.5 align-middle">
        {row.parentLabel !== "—" ? (
          <span className="font-medium text-slate-700 dark:text-slate-300">{row.parentLabel}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 align-middle">
        {row.subCount > 0 ? (
          <Badge variant="secondary" className="rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none">{row.subCount}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-2 align-middle text-right">
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={onEdit}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className={!row.subCount ? "text-destructive focus:text-destructive" : ""}
              disabled={!row.subCount || disabled}
              onSelect={(e) => e.preventDefault()}
              onClick={row.subCount === 0 ? onDelete : undefined}
            >
              {!row.subCount ? "Has subcategories" : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

function CategoriesClientPage() {
  const { data: rawCategories, isLoading } = useGetCategories()
  const { mutate: createCategory, isPending: isCreating } = useCreateCategories()
  const { mutate: updateCategory, isPending: isUpdating } = useUpdateCategory()
  const { mutate: deleteCategory, isPending: isDeleting } = useDeleteCategory()
  const { mutate: bulkDelete, isPending: isBulkDeleting } = useBulkDeleteCategories()

  const [searchQuery, setSearchQuery] = useQueryState("search", parseAsString.withDefault(""))
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CategoryRow | null>(null)

  const [categoryName, setCategoryName] = useState("")
  const [categoryValue, setCategoryValue] = useState("")
  const [selectedParentValue, setSelectedParentValue] = useState("none")
  const [seoTitle, setSeoTitle] = useState("")
  const [seoDescription, setSeoDescription] = useState("")
  const [seoContent, setSeoContent] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const categories = useMemo(() => (rawCategories as FlatCategory[] | undefined) ?? [], [rawCategories])
  const { mutate: reorderCategories, isPending: isReordering } = useReorderCategories()

  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.label.localeCompare(b.label)
    ), [categories]
  )

  const [localOrder, setLocalOrder] = useState<FlatCategory[] | null>(null)
  const displayCategories = localOrder ?? sortedCategories

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const previousOrder = displayCategories
    const oldIndex = previousOrder.findIndex((c) => c.value === active.id)
    const newIndex = previousOrder.findIndex((c) => c.value === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const nextOrder = arrayMove(previousOrder, oldIndex, newIndex)
    setLocalOrder(nextOrder)
    reorderCategories(
      nextOrder.map((c, i) => ({ value: c.value, order: i })),
      { onError: () => setLocalOrder(previousOrder) }
    )
  }

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const parentMap = useMemo(() => new Map(categories.map((c) => [c.value, c.label])), [categories])
  const subCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of categories) {
      if (c.parentId) {
        const parent = categories.find((p) => p.id === c.parentId)
        if (parent) {
          counts.set(parent.value, (counts.get(parent.value) || 0) + 1)
        }
      }
    }
    return counts
  }, [categories])

  const rows: CategoryRow[] = useMemo(() => {
    const filtered = searchQuery
      ? displayCategories.filter(
          (c) =>
            c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.value.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : displayCategories
    return filtered.map((c) => ({
      ...c,
      parentLabel: c.parentId ? parentMap.get(categories.find((p) => p.id === c.parentId)?.value ?? "") ?? "—" : "—",
      subCount: subCounts.get(c.value) ?? 0,
    }))
  }, [categories, displayCategories, searchQuery, parentMap, subCounts])
  useRememberRows("categories.list", isLoading ? undefined : rows.length)

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
    if (!imageFile) return imageUrl || null
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("image", imageFile)
      const res = await fetch("/api/categories/upload-image", { method: "POST", body: formData })
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

    const parentCategory = selectedParentValue !== "none"
      ? categories.find((c) => c.value === selectedParentValue)
      : null
    createCategory(
      {
        label: categoryName,
        value: categoryValue,
        parentId: parentCategory?.id ?? null,
        image: finalImage ?? null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        seoContent: seoContent || null,
      },
      {
        onSuccess: () => {
          setCategoryName("")
          setCategoryValue("")
          setSelectedParentValue("none")
          setSeoTitle("")
          setSeoDescription("")
          setSeoContent("")
          setImageFile(null)
          setImagePreview("")
          setImageUrl("")
          setCreateOpen(false)
        },
      }
    )
  }

  const handleEdit = (category: CategoryRow) => {
    setCategoryName(category.label)
    setCategoryValue(category.value)
    setSelectedParentValue(category.parentId ? categories.find(c => c.id === category.parentId)?.value ?? "none" : "none")
    setSeoTitle(category.seoTitle || "")
    setSeoDescription(category.seoDescription || "")
    setSeoContent(category.seoContent || "")
    setImagePreview(category.image || "")
    setImageUrl(category.image || "")
    setImageFile(null)
    setEditTarget(category)
    setEditOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return

    const finalImage = await uploadImage()
    if (imageFile && !finalImage) return

    const parentCategory = selectedParentValue !== "none"
      ? categories.find((c) => c.value === selectedParentValue)
      : null

    updateCategory(
      {
        currentValue: editTarget.value,
        value: categoryValue,
        label: categoryName,
        parentId: parentCategory?.id ?? null,
        image: finalImage ?? null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        seoContent: seoContent || null,
      },
      {
        onSuccess: () => {
          setCategoryName("")
          setCategoryValue("")
          setSelectedParentValue("none")
          setSeoTitle("")
          setSeoDescription("")
          setSeoContent("")
          setImageFile(null)
          setImagePreview("")
          setImageUrl("")
          setEditTarget(null)
          setEditOpen(false)
        },
      }
    )
  }

  const rootCategories = categories.filter((c) => !c.parentId)
  const selectedCount = Object.keys(rowSelection).length

  const toggleSelect = (value: string, checked: boolean) => {
    setRowSelection((prev) => ({ ...prev, [value]: checked }))
  }

  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {}
    if (checked) rows.forEach((r) => (next[r.value] = true))
    setRowSelection(next)
  }

  const handleBulkDelete = () => {
    const values = rows.filter((r) => rowSelection[r.value]).map((r) => r.value)
    if (values.length === 0) return
    bulkDelete(values, {
      onSuccess: () => {
        setRowSelection({})
        setConfirmBulkDelete(false)
      },
      onError: () => setConfirmBulkDelete(false),
    })
  }

  if (isLoading) {
    return <CategoriesPageSkeleton />
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 animate-in fade-in duration-300">
      <PageTitle title="Categories" description="Organize products into categories and subcategories" />
      <div className="flex items-center justify-end gap-4">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className={cn(buttonVariants(), "gap-2 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap rounded-full px-5 h-9 text-xs font-semibold")}>
            <Plus className="h-4 w-4" />
            Add Category
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedParentValue !== "none" ? "Add Subcategory" : "Create Category"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Parent Category</label>
                <select
                  value={selectedParentValue}
                  onChange={(e) => setSelectedParentValue(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="none">None (top-level)</option>
                  {rootCategories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Name</label>
                <Input
                  placeholder="Category Name"
                  value={categoryName}
                  onChange={(e) => {
                    setCategoryName(e.target.value)
                    setCategoryValue(generateSlug(e.target.value))
                  }}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Slug</label>
                <Input
                  placeholder="category-slug"
                  value={categoryValue}
                  onChange={(e) => setCategoryValue(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  SEO Title <span className="text-xs">(optional)</span>
                </label>
                <Input
                  placeholder={categoryName || "e.g. Best Comforter Price in Bangladesh"}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  maxLength={70}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  SEO Description <span className="text-xs">(optional)</span>
                </label>
                <Textarea
                  placeholder="Shop premium comforter sets online in Bangladesh with cash on delivery..."
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  maxLength={160}
                  rows={3}
                />
                {/* maxLength silently cuts pasted text mid-word (two live
                    descriptions ended in "replacemen") — the counter turning
                    red at the limit makes that visible. */}
                <p className={`text-xs text-right ${seoDescription.length >= 160 ? "text-destructive" : "text-muted-foreground"}`}>
                  {seoDescription.length}/160
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  SEO Content <span className="text-xs">(optional, shown below the product grid — headings, buying-guide, price ranges, etc.)</span>
                </label>
                <Textarea
                  placeholder={"## Comforter Price in Bangladesh\n\nShort intro paragraph...\n\n### Why Choose Our Comforters\n- Point one\n- Point two"}
                  value={seoContent}
                  onChange={(e) => setSeoContent(e.target.value)}
                  maxLength={8000}
                  rows={8}
                  className="font-mono text-xs"
                />
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

              <Button type="submit" className="w-full" disabled={isCreating || isUploading}>
                {(isCreating || isUploading) ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {isUploading ? "Uploading..." : "Creating..."}</>
                ) : (
                  selectedParentValue !== "none" ? "Add Subcategory" : "Create Category"
                )}
              </Button>

              {selectedParentValue !== "none" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs"
                  onClick={() => setSelectedParentValue("none")}
                >
                  Switch to top-level
                </Button>
              )}
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setCategoryName("")
            setCategoryValue("")
            setSelectedParentValue("none")
            setSeoTitle("")
            setSeoDescription("")
            setSeoContent("")
            setImageFile(null)
            setImagePreview("")
            setImageUrl("")
            setEditTarget(null)
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Parent Category</label>
                <select
                  value={selectedParentValue}
                  onChange={(e) => setSelectedParentValue(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="none">None (top-level)</option>
                  {rootCategories.filter(c => c.value !== editTarget?.value).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Name</label>
                <Input
                  placeholder="Category Name"
                  value={categoryName}
                  onChange={(e) => {
                    setCategoryName(e.target.value)
                    setCategoryValue(generateSlug(e.target.value))
                  }}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Slug</label>
                <Input
                  placeholder="category-slug"
                  value={categoryValue}
                  onChange={(e) => setCategoryValue(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  SEO Title <span className="text-xs">(optional)</span>
                </label>
                <Input
                  placeholder={categoryName || "e.g. Best Comforter Price in Bangladesh"}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  maxLength={70}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  SEO Description <span className="text-xs">(optional)</span>
                </label>
                <Textarea
                  placeholder="Shop premium comforter sets online in Bangladesh with cash on delivery..."
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  maxLength={160}
                  rows={3}
                />
                {/* maxLength silently cuts pasted text mid-word (two live
                    descriptions ended in "replacemen") — the counter turning
                    red at the limit makes that visible. */}
                <p className={`text-xs text-right ${seoDescription.length >= 160 ? "text-destructive" : "text-muted-foreground"}`}>
                  {seoDescription.length}/160
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  SEO Content <span className="text-xs">(optional, shown below the product grid — headings, buying-guide, price ranges, etc.)</span>
                </label>
                <Textarea
                  placeholder={"## Comforter Price in Bangladesh\n\nShort intro paragraph...\n\n### Why Choose Our Comforters\n- Point one\n- Point two"}
                  value={seoContent}
                  onChange={(e) => setSeoContent(e.target.value)}
                  maxLength={8000}
                  rows={8}
                  className="font-mono text-xs"
                />
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
                  <><Loader2 className="h-4 w-4 animate-spin" /> {isUploading ? "Uploading..." : "Updating..."}</>
                ) : (
                  "Update Category"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value || null)}
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
          </div>
        </div>

        <DndContext
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rows.map((r): UniqueIdentifier => r.value)}
            strategy={verticalListSortingStrategy}
          >
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-hidden overflow-x-auto w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-full">
                <thead className="bg-slate-50/70 dark:bg-muted/30">
                  <tr className="hover:bg-transparent border-b border-slate-100 dark:border-slate-800">
                    <th className="w-10 px-3 py-3 text-left font-bold text-slate-700 dark:text-slate-300 text-sm whitespace-nowrap"></th>
                    <th className="w-10 px-3 py-3 text-left font-bold text-slate-700 dark:text-slate-300 text-sm whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={rows.length > 0 && rows.every((r) => rowSelection[r.value])}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-3 py-3 text-left font-bold text-slate-700 dark:text-slate-300 text-sm whitespace-nowrap">Image</th>
                    <th className="px-3 py-3 text-left font-bold text-slate-700 dark:text-slate-300 text-sm whitespace-nowrap">
                      <Button variant="ghost" className="-ml-4 h-8 data-[state=open]:bg-accent font-bold">
                        Label <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </th>
                    <th className="px-3 py-3 text-left font-bold text-slate-700 dark:text-slate-300 text-sm whitespace-nowrap">Slug</th>
                    <th className="px-3 py-3 text-left font-bold text-slate-700 dark:text-slate-300 text-sm whitespace-nowrap">Parent</th>
                    <th className="px-3 py-3 text-left font-bold text-slate-700 dark:text-slate-300 text-sm whitespace-nowrap">Subcategories</th>
                    <th className="px-3 py-3 text-right font-bold text-slate-700 dark:text-slate-300 text-sm whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <DraggableRow
                      key={row.value}
                      row={row}
                      selected={!!rowSelection[row.value]}
                      onSelect={(checked) => toggleSelect(row.value, checked)}
                      onEdit={() => handleEdit(row)}
                      onDelete={() => setDeleteTarget(row)}
                      disabled={isDeleting}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                      {searchQuery ? "No results." : "No categories yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SortableContext>
      </DndContext>
      {isReordering && <p className="text-xs text-muted-foreground">Saving order...</p>}

      <div className="flex items-center justify-between px-2 py-1">
        <div className="text-xs text-muted-foreground">
          {selectedCount} of {rows.length} row(s) selected.
        </div>
      </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.label}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => {
                if (deleteTarget) {
                  deleteCategory({ value: deleteTarget.value }, { onSuccess: () => setDeleteTarget(null) })
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
            <AlertDialogTitle>Delete Selected Categories</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} selected categories? Categories with subcategories will be skipped.
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

export default CategoriesClientPage
