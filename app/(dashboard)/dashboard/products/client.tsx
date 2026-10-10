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
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Copy, MoreVertical, Plus, Play, Search, Trash2, Loader2, LayoutGrid, Table2, Layers } from "lucide-react"
import BrandedVideoPlayer from "@/components/product/branded-video-player"
import { productVideoPoster, productVideoUrl } from "@/lib/product-video"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGetProducts, useGetDuplicateProducts, useGetVideoStats } from "@/features/product/api/use-get-products"
import { useGetCategories } from "@/features/categories/api/use-get-categories"
import { useDeleteProduct } from "@/features/dashboard/api/use-delete-product"
import { useBulkDeleteProducts } from "@/features/dashboard/api/use-bulk-delete-products"
import { useBulkUpdateFeatured } from "@/features/dashboard/api/use-bulk-update-featured"
import { useCurrency } from "@/hooks/use-currency"
import { sanitizeRichText } from "@/lib/sanitize"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CardGridSkeleton,
  FilterBarSkeleton,
  PaginationSkeleton,
  TableSkeleton,
} from "@/components/dashboard/skeletons"
import Link from "next/link"

export type ProductColumn = {
  id: string
  name: string
  category: string
  price: number
  stock: number
  isFeatured: boolean
  createdAt: string
  images: string[]
}

const FEATURED_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "true", label: "Featured" },
  { value: "false", label: "Standard" },
]

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name: A → Z" },
  { value: "name-desc", label: "Name: Z → A" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
  { value: "stock-asc", label: "Stock: Low → High" },
  { value: "stock-desc", label: "Stock: High → Low" },
  { value: "bestselling", label: "Best selling" },
]

// Serve Cloudinary images resized + in a modern format — originals can be
// multi-MB PNGs, which is slow to fetch inside the dialog.
function optimizedImage(src: string | undefined, width: number) {
  if (!src) return "/placeholder.jpg"
  if (!src.includes("res.cloudinary.com") || !src.includes("/upload/")) return src
  return src.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`)
}

export default function ProductsClientPage() {
  const { formatAmount } = useCurrency()
  const { mutate: deleteProduct, isPending: isDeleting } = useDeleteProduct()
  const { mutate: bulkDelete, isPending: isBulkDeleting } = useBulkDeleteProducts()
  const { mutate: updateFeatured, isPending: isUpdatingFeatured } = useBulkUpdateFeatured()
  const [productToDelete, setProductToDelete] = useState<ProductColumn | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const [searchQuery, setSearchQuery] = useQueryState("search", parseAsString.withDefault(""))
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1))
  const [limit, setLimit] = useQueryState("limit", parseAsInteger.withDefault(10))
  const [categoryId, setCategoryId] = useQueryState("category", parseAsString.withDefault("Comforters"))
  const [featuredFilter, setFeaturedFilter] = useQueryState("featured", parseAsString.withDefault("all"))
  const [sort, setSort] = useQueryState("sort", parseAsString.withDefault("newest"))
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  // The details dialog opens on the product's video when it has one (the
  // storefront gallery does the same), otherwise on the first photo.
  const [showVideo, setShowVideo] = useState(false)
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [view, setView] = useQueryState("view", parseAsString.withDefault("grid"))
  const isGrid = view === "grid"
  const isDuplicates = view === "duplicates"
  const isTable = !isGrid && !isDuplicates

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

  const { data: categories } = useGetCategories()

  const { data: products, isLoading } = useGetProducts({
    page: page.toString(),
    search: debouncedSearch,
    sort,
    limit: limit.toString(),
    admin: "true",
    category: categoryId === "all" ? undefined : categoryId,
    featured: featuredFilter === "all" ? undefined : featuredFilter,
  })

  const { data: duplicateGroups, isLoading: isDuplicatesLoading } = useGetDuplicateProducts(
    {
      category: categoryId === "all" ? undefined : categoryId,
      search: debouncedSearch,
    },
    { enabled: isDuplicates }
  )

  const detailsProduct = (products?.data ?? []).find((p) => p.id === detailsId) ?? null
  const detailsHtml = detailsProduct?.description ? sanitizeRichText(detailsProduct.description) : ""

  const handleBulkDelete = () => {
    const ids = (products?.data ?? [])
      .filter((_, index) => rowSelection[index.toString()])
      .map((p) => p.id)
    if (ids.length === 0) return
    bulkDelete(ids, {
      onSuccess: () => {
        setRowSelection({})
        setConfirmBulkDelete(false)
      },
      onError: () => setConfirmBulkDelete(false),
    })
  }

  const columns: ColumnDef<ProductColumn>[] = [
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
      accessorKey: "images",
      header: "Image",
      enableHiding: false,
      cell: ({ row }) => (
        <img
          src={row.original.images[0] || "/placeholder.jpg"}
          alt="Product"
          className="h-10 w-10 object-cover rounded"
        />
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => formatAmount(row.original.price),
    },
    {
      accessorKey: "stock",
      header: "Stock",
    },
    {
      accessorKey: "isFeatured",
      header: "Featured",
      cell: ({ row }) => (
        <Switch
          checked={row.original.isFeatured}
          onCheckedChange={(checked) => 
            updateFeatured({ ids: [row.original.id], isFeatured: checked })
          }
          disabled={isUpdatingFeatured}
        />
      ),
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
        const product = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Link 
              href={`/dashboard/products/create?duplicate=${product.id}`}
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
              title="Duplicate"
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href={`/dashboard/products/update/${product.id}`}>
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                </Link>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={isDeleting}
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => setProductToDelete(product)}
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

  const filterBar = (
          <div className="flex flex-wrap sm:flex-nowrap items-stretch sm:items-center gap-2.5 w-full">
            <div className="relative flex-1 min-w-[140px] sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value || null)
                  setPage(1)
                }}
                className="pl-9 w-full rounded-full text-xs font-semibold"
              />
            </div>
            <Select value={categoryId} onValueChange={(val) => { setCategoryId(val || "all"); setPage(1); }}>
              <SelectTrigger className="w-[130px] sm:w-[170px] rounded-full text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none h-8 capitalize">
                <SelectValue placeholder="Category">
                  {categoryId === "all" ? "All Categories" : categoryId}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all" label="All Categories" className="capitalize text-xs font-medium">All Categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.label} label={cat.label} className="capitalize text-xs font-medium">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <Select value={featuredFilter} onValueChange={(val) => { setFeaturedFilter(val || "all"); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[140px] rounded-full text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none h-8 capitalize">
                  <SelectValue placeholder="Status">
                    {FEATURED_OPTIONS.find((opt) => opt.value === featuredFilter)?.label ?? "Status"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {FEATURED_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} label={opt.label} className="capitalize text-xs font-medium">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(val) => { setSort(val || "newest"); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[170px] rounded-full text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none h-8 capitalize">
                  <SelectValue placeholder="Sort by">
                    {SORT_OPTIONS.find((opt) => opt.value === sort)?.label ?? "Sort by"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} label={opt.label} className="capitalize text-xs font-medium">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{selectedCount} selected</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 rounded-full text-xs font-semibold h-8 px-3"
                  onClick={() => setConfirmBulkDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            )}
          </div>
  )

  // Sort/Featured/pagination don't mean anything for a duplicate-image
  // report, so this view only keeps the two filters that actually narrow it.
  const duplicatesFilterBar = (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
      <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value || null)}
          className="pl-9 w-full rounded-full text-xs font-semibold"
        />
      </div>
      <Select value={categoryId} onValueChange={(val) => setCategoryId(val || "all")}>
        <SelectTrigger className="w-full sm:w-[170px] rounded-full text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none h-8 capitalize">
          <SelectValue placeholder="Category">
            {categoryId === "all" ? "All Categories" : categoryId}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-2xl">
          <SelectItem value="all" label="All Categories" className="capitalize text-xs font-medium">All Categories</SelectItem>
          {categories?.map((cat) => (
            <SelectItem key={cat.id} value={cat.label} label={cat.label} className="capitalize text-xs font-medium">
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex-1 space-y-3 sm:space-y-6 p-2 sm:p-4 md:p-8 pt-2 sm:pt-4 md:pt-6">
        <div className="flex items-center justify-end sm:justify-between gap-3">
          <div className="hidden sm:block">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Products</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Manage your product catalog and inventory</p>
          </div>
          <Skeleton className="h-9 w-40 rounded-full shrink-0" />
        </div>
        <div className="rounded-3xl bg-white dark:bg-card p-2 sm:p-6 space-y-2 sm:space-y-4">
          <FilterBarSkeleton />
          {isGrid ? <CardGridSkeleton count={limit > 12 ? 12 : limit} /> : <TableSkeleton rows={Math.min(limit, 10)} cols={7} />}
          <PaginationSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-3 sm:space-y-6 p-2 sm:p-4 md:p-8 pt-2 sm:pt-4 md:pt-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-end sm:justify-between gap-3">
        <div className="hidden sm:block">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Manage your product catalog and inventory</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button nativeButton={false} render={<Link href="/dashboard/products/create" />} className="gap-2 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap rounded-full px-4 sm:px-5 h-9 text-xs font-semibold shrink-0">
            <Plus className="h-4 w-4" />
            Add New
          </Button>
          <div className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-muted/40 p-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Table view"
              aria-pressed={isTable}
              title="Table view"
              onClick={() => setView("table")}
              className={cn(
                "rounded-full h-7 w-7",
                isTable && "bg-white dark:bg-slate-800 shadow-sm"
              )}
            >
              <Table2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Grid view"
              aria-pressed={isGrid}
              title="Grid view"
              onClick={() => setView("grid")}
              className={cn(
                "rounded-full h-7 w-7",
                isGrid && "bg-white dark:bg-slate-800 shadow-sm"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Duplicates view"
              aria-pressed={isDuplicates}
              title="Products sharing a duplicate image"
              onClick={() => setView("duplicates")}
              className={cn(
                "rounded-full h-7 w-7",
                isDuplicates && "bg-white dark:bg-slate-800 shadow-sm"
              )}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white dark:bg-card p-2 sm:p-6 border-none shadow-none space-y-2 sm:space-y-4">
        {isDuplicates ? (
          <div className="space-y-2 sm:space-y-4">
            {duplicatesFilterBar}

            {isDuplicatesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl" />
                ))}
              </div>
            ) : (duplicateGroups?.data ?? []).length === 0 ? (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center text-muted-foreground text-sm">
                No duplicate images found.
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {(duplicateGroups?.data ?? []).map((group) => (
                  <div
                    key={`${group.categoryLabel}-${group.image}`}
                    className="rounded-2xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={optimizedImage(group.image, 100)}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold capitalize truncate">{group.categoryLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.products.length} products share this image
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {group.products.map((product) => (
                        <Link
                          key={product.id}
                          href={`/dashboard/products/update/${product.id}`}
                          className="flex items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-background p-2 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                        >
                          <img
                            src={product.images[0] || "/placeholder.jpg"}
                            alt={product.name}
                            className="h-9 w-9 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{product.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {formatAmount(product.price)} ·{" "}
                              {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : isGrid ? (
          <div className="space-y-2 sm:space-y-4">
            {filterBar}

            {(products?.data ?? []).length === 0 ? (
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center text-muted-foreground text-sm">
                No results.
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
                {(products?.data ?? []).map((product, index) => {
                  const key = index.toString()
                  const isSelected = !!rowSelection[key]
                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        setActiveImage(0)
                        setShowVideo(!!product.video)
                        setDetailsId(product.id)
                      }}
                      className={cn(
                        "group relative cursor-pointer rounded-2xl border border-slate-100 dark:border-slate-800 bg-background overflow-hidden transition-colors hover:border-slate-300 dark:hover:border-slate-600",
                        isSelected && "border-slate-900 dark:border-indigo-500"
                      )}
                    >
                      <div className="relative aspect-square bg-slate-50 dark:bg-muted/30">
                        <img
                          src={product.images[0] || "/placeholder.jpg"}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                        <input
                          type="checkbox"
                          className="absolute left-3 top-3 h-4 w-4 rounded border-input bg-white"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setRowSelection((prev) => {
                              const next = { ...prev }
                              if (e.target.checked) next[key] = true
                              else delete next[key]
                              return next
                            })
                          }
                          aria-label={`Select ${product.name}`}
                        />
                        {product.isFeatured && (
                          <Badge className="absolute right-3 top-3 rounded-full text-[10px] font-semibold">
                            Featured
                          </Badge>
                        )}
                      </div>

                      <div className="p-2 sm:p-4 space-y-1.5 sm:space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground capitalize truncate">
                              {product.category}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Link
                              href={`/dashboard/products/create?duplicate=${product.id}`}
                              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                              title="Duplicate"
                            >
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
                                <MoreVertical className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <Link href={`/dashboard/products/update/${product.id}`}>
                                  <DropdownMenuItem>Edit</DropdownMenuItem>
                                </Link>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  disabled={isDeleting}
                                  onSelect={(e) => e.preventDefault()}
                                  onClick={() => setProductToDelete(product)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm">{formatAmount(product.price)}</span>
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              product.stock > 0 ? "text-muted-foreground" : "text-destructive"
                            )}
                          >
                            {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                          </span>
                        </div>

                        <div
                          className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Label htmlFor={`featured-${product.id}`} className="text-xs text-muted-foreground pt-2">
                            Featured
                          </Label>
                          <Switch
                            id={`featured-${product.id}`}
                            className="mt-2"
                            checked={product.isFeatured}
                            onCheckedChange={(checked) =>
                              updateFeatured({ ids: [product.id], isFeatured: checked })
                            }
                            disabled={isUpdatingFeatured}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1">
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">
                  Page {page} of {products?.totalPages || 1}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Per page</span>
                  <Select
                    value={limit.toString()}
                    onValueChange={(value) => {
                      if (!value) return
                      setLimit(Number(value))
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px] rounded-lg text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {[10, 25, 50, 100].map((size) => (
                        <SelectItem key={size} value={size.toString()} className="text-xs font-medium">
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-8 px-2.5 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-8 px-2.5 text-xs"
                  disabled={page >= (products?.totalPages ?? 1)}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        ) : (
        <DataTable<ProductColumn, unknown>
          columns={columns}
          data={products?.data ?? []}
          manualPagination
          pageCount={products?.totalPages ?? -1}
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
          searchSlot={filterBar}
        />
        )}
      </div>

      <Dialog open={!!detailsProduct} onOpenChange={(open) => !open && setDetailsId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          {detailsProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{detailsProduct.name}</DialogTitle>
                <DialogDescription className="capitalize">
                  {detailsProduct.categoryLabel || detailsProduct.category || "Uncategorized"}
                  {detailsProduct.sku ? ` · SKU ${detailsProduct.sku}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-slate-50 dark:bg-muted/30">
                    {detailsProduct.video && showVideo ? (
                      <div className="h-full w-full bg-black">
                        <BrandedVideoPlayer
                          key={detailsProduct.video}
                          label={`${detailsProduct.name} – video`}
                          poster={productVideoPoster(detailsProduct.video)}
                          sources={[
                            { src: productVideoUrl(detailsProduct.video), type: "video/mp4" },
                            { src: detailsProduct.video },
                          ]}
                        />
                      </div>
                    ) : (
                      <img
                        key={detailsProduct.images[activeImage]}
                        src={optimizedImage(detailsProduct.images[activeImage] || detailsProduct.images[0], 800)}
                        alt={detailsProduct.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const img = e.currentTarget
                          if (!img.src.endsWith("/placeholder.jpg")) img.src = "/placeholder.jpg"
                        }}
                      />
                    )}
                  </div>
                  {detailsProduct.images.length + (detailsProduct.video ? 1 : 0) > 1 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {detailsProduct.video && (
                        <button
                          type="button"
                          onClick={() => setShowVideo(true)}
                          aria-label="Play product video"
                          className={cn(
                            "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-black",
                            showVideo ? "border-slate-900 dark:border-indigo-500" : "border-transparent"
                          )}
                        >
                          <img src={productVideoPoster(detailsProduct.video, 120)} alt="" className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                            <Play className="h-4 w-4 fill-white text-white" />
                          </span>
                        </button>
                      )}
                      {detailsProduct.images.map((src, i) => (
                        <button
                          key={`${src}-${i}`}
                          type="button"
                          onClick={() => {
                            setActiveImage(i)
                            setShowVideo(false)
                          }}
                          className={cn(
                            "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2",
                            !showVideo && i === activeImage ? "border-slate-900 dark:border-indigo-500" : "border-transparent"
                          )}
                        >
                          <img src={optimizedImage(src, 120)} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl font-bold">{formatAmount(detailsProduct.price)}</span>
                    {detailsProduct.discount > 0 && (
                      <Badge variant="secondary" className="rounded-full text-[10px] font-semibold">
                        {detailsProduct.discount}% off
                      </Badge>
                    )}
                    {detailsProduct.isFeatured && (
                      <Badge className="rounded-full text-[10px] font-semibold">Featured</Badge>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <dt className="text-muted-foreground">Stock</dt>
                    <dd className={cn("font-semibold", detailsProduct.stock <= 0 && "text-destructive")}>
                      {detailsProduct.stock > 0 ? detailsProduct.stock : "Out of stock"}
                    </dd>
                    <dt className="text-muted-foreground">Added</dt>
                    <dd className="font-semibold">{new Date(detailsProduct.createdAt).toLocaleDateString()}</dd>
                    <dt className="text-muted-foreground">Updated</dt>
                    <dd className="font-semibold">{new Date(detailsProduct.updatedAt).toLocaleDateString()}</dd>
                  </dl>

                  {detailsProduct.video && <VideoStatsSummary productId={detailsProduct.id} />}

                  {detailsProduct.sizes?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Sizes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProduct.sizes.map((size) => (
                          <Badge key={size} variant="outline" className="rounded-full text-[10px]">{size}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailsProduct.colors?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Variants</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProduct.colors.map((v) => (
                          <Badge key={v.name} variant="outline" className="rounded-full text-[10px]">
                            {v.name}{v.price != null ? ` · ${formatAmount(v.price)}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailsProduct.tags?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProduct.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="rounded-full text-[10px]">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {detailsHtml && (
                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert rounded-2xl bg-slate-50 dark:bg-muted/30 p-4 leading-relaxed prose-headings:mt-0 prose-headings:mb-2 prose-h2:text-base prose-h4:text-sm prose-p:my-1.5 prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline"
                    dangerouslySetInnerHTML={{ __html: detailsHtml }}
                  />
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Link
                  href={`/dashboard/products/create?duplicate=${detailsProduct.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full gap-1.5")}
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Link>
                <Link
                  href={`/dashboard/products/update/${detailsProduct.id}`}
                  className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
                >
                  Edit
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{productToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => {
                if (productToDelete) {
                  deleteProduct(productToDelete.id, { onSuccess: () => setProductToDelete(null) })
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
            <AlertDialogTitle>Delete Selected Products</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} selected products? This action cannot be undone.
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

// Reels analytics for one product's video: views, average watch time, and
// how often watching led to an Order Now tap (or a share).
function VideoStatsSummary({ productId }: { productId: string }) {
  const { data, isLoading } = useGetVideoStats()
  const stats = data?.data[productId]
  const views = stats?.views ?? 0
  const avgWatch = views ? Math.round((stats?.watchSeconds ?? 0) / views) : 0
  const orderRate = views ? ((stats?.orderClicks ?? 0) / views) * 100 : 0

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Video performance (Reels)</p>
      {isLoading ? (
        <Skeleton className="h-14 w-full rounded-xl" />
      ) : (
        <div className="grid grid-cols-4 gap-2 rounded-xl border border-slate-100 dark:border-slate-800 p-2.5 text-center text-xs">
          <div>
            <p className="text-base font-bold tabular-nums">{views.toLocaleString()}</p>
            <p className="text-muted-foreground">Views</p>
          </div>
          <div>
            <p className="text-base font-bold tabular-nums">{avgWatch}s</p>
            <p className="text-muted-foreground">Avg watch</p>
          </div>
          <div>
            <p className="text-base font-bold tabular-nums">{(stats?.orderClicks ?? 0).toLocaleString()}</p>
            <p className="text-muted-foreground">Order taps{views ? ` · ${orderRate.toFixed(1)}%` : ""}</p>
          </div>
          <div>
            <p className="text-base font-bold tabular-nums">{(stats?.shares ?? 0).toLocaleString()}</p>
            <p className="text-muted-foreground">Shares</p>
          </div>
        </div>
      )}
    </div>
  )
}
