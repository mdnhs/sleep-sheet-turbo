"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Copy, Download, ImageOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/dashboard/skeletons";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useGetInfiniteProducts } from "@/features/product/api/use-get-products";
import { useSyncProductsToSheet } from "@/features/google-sheets/api/use-google-sheets";

interface ImageRow {
  productId: string;
  productName: string;
  categoryLabel: string;
  imageUrl: string;
  imageIndex: number;
  price: number;
  isAvailable: boolean;
}

export default function ImagesClientPage() {
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncCategories, setSyncCategories] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({
    current: 0,
    total: 0,
    batch: 0,
    totalBatches: 0,
  });
  const syncProductsToSheet = useSyncProductsToSheet();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGetInfiniteProducts({ admin: "true", limit: "100", sort: "newest" });

  // The list endpoint is paginated (capped at 100/page); pull every page up
  // front so the table + xlsx export always cover the full catalog, not just
  // the first page.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const rows: ImageRow[] = useMemo(() => {
    const products = data?.pages.flatMap((page) => page.data) ?? [];
    return products.flatMap((product) =>
      (product.images || []).map((url: string, idx: number) => ({
        productId: product.id,
        productName: product.name,
        categoryLabel: product.categoryLabel || "Uncategorized",
        imageUrl: url,
        imageIndex: idx + 1,
        price: Number(product.price) || 0,
        isAvailable: Number(product.stock) > 0,
      })),
    );
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        r.categoryLabel.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const selectedRows = filteredRows.filter((_, index) => rowSelection[index.toString()]);

  // Categories the sync dialog can offer, with how many images each has —
  // derived from the same data already loaded for the table, so it always
  // matches what's visible here.
  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.categoryLabel, (counts.get(r.categoryLabel) || 0) + 1));
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const selectedSyncCategories = Object.keys(syncCategories).filter((c) => syncCategories[c]);

  const handleSync = async () => {
    if (selectedSyncCategories.length === 0) {
      toast.error("Select at least one category to sync");
      return;
    }

    const selectedCategorySet = new Set(selectedSyncCategories);
    const targetRows = rows.filter((r) => selectedCategorySet.has(r.categoryLabel));

    if (targetRows.length === 0) {
      toast.error("No images found in selected categories");
      return;
    }

    const BATCH_SIZE = 15;
    const batches: ImageRow[][] = [];
    for (let i = 0; i < targetRows.length; i += BATCH_SIZE) {
      batches.push(targetRows.slice(i, i + BATCH_SIZE));
    }

    setIsSyncing(true);
    setSyncProgress({
      current: 0,
      total: targetRows.length,
      batch: 0,
      totalBatches: batches.length,
    });

    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const isFirst = i === 0;

        await syncProductsToSheet.mutateAsync({
          clear: isFirst,
          products: batch.map((r) => ({
            name: r.productName,
            category: r.categoryLabel,
            price: r.price,
            isAvailable: r.isAvailable,
            imageUrl: r.imageUrl,
          })),
        });

        const syncedSoFar = Math.min((i + 1) * BATCH_SIZE, targetRows.length);
        setSyncProgress({
          current: syncedSoFar,
          total: targetRows.length,
          batch: i + 1,
          totalBatches: batches.length,
        });
      }

      toast.success(`Successfully synced all ${targetRows.length} image(s) to n8n!`);
      setTimeout(() => {
        setIsSyncDialogOpen(false);
        setIsSyncing(false);
        setSyncCategories({});
        setSyncProgress({ current: 0, total: 0, batch: 0, totalBatches: 0 });
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Failed to sync products to n8n");
      setIsSyncing(false);
    }
  };

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Image URL copied to clipboard");
  };

  const handleExport = () => {
    if (selectedRows.length === 0) {
      toast.error("Select at least one image to export");
      return;
    }
    const sheetData = selectedRows.map((r) => ({
      Category: r.categoryLabel,
      Product: r.productName,
      "Image URL": r.imageUrl,
    }));
    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Images");
    XLSX.writeFile(
      workbook,
      `product-images-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    toast.success(`Exported ${selectedRows.length} image(s)`);
  };

  const columns: ColumnDef<ImageRow>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={row.getIsSelected()}
          onChange={(e) => row.toggleSelected(!!e.target.checked)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "categoryLabel",
      header: "Category",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.categoryLabel}</span>
      ),
    },
    {
      accessorKey: "productName",
      header: "Product",
      cell: ({ row }) => (
        <span className="block max-w-[220px] truncate">
          {row.original.productName}
        </span>
      ),
    },
    {
      id: "image",
      header: "Image",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.original.imageUrl}
            alt={row.original.productName}
            className="h-12 w-12 shrink-0 rounded-md object-cover bg-muted"
          />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-md bg-muted flex items-center justify-center">
            <ImageOff className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
    },
    {
      accessorKey: "imageUrl",
      header: "Cloudinary URL",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 max-w-[380px]">
          <span className="truncate text-xs text-muted-foreground">
            {row.original.imageUrl}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => handleCopy(row.original.imageUrl)}
            title="Copy URL"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Images
          </h2>
          <p className="text-sm text-muted-foreground">
            All product images with their Cloudinary URLs, by category.
          </p>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} cols={5} />
      ) : (
        <div className="animate-in fade-in duration-300">
        <DataTable
          columns={columns}
          data={filteredRows}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          searchSlot={
            <Input
              placeholder="Search by product or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm rounded-full"
            />
          }
          actionSlot={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={selectedRows.length === 0}
                className="rounded-full gap-1.5 shrink-0 text-xs font-semibold border bg-slate-50 dark:bg-muted/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Selected ({selectedRows.length})</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsSyncDialogOpen(true)}
                title="Sync to n8n Product Cache"
                className="rounded-full shrink-0 h-8 w-8 border bg-slate-50 dark:bg-muted/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </>
          }
        />
        </div>
      )}

      <Dialog
        open={isSyncDialogOpen}
        onOpenChange={(open) => {
          if (!isSyncing) setIsSyncDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sync Products to n8n Cache</DialogTitle>
            <DialogDescription>
              {isSyncing
                ? "Sending product images to n8n and uploading Facebook message attachments. Please keep this open."
                : "Pick the categories to sync. Selected products and images will be sent directly to n8n to refresh Facebook message attachments and update the Product Cache table."}
            </DialogDescription>
          </DialogHeader>

          {isSyncing ? (
            <div className="py-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Syncing to n8n Cache...
                </span>
                <span className="text-xs font-mono font-bold text-primary">
                  {syncProgress.total > 0
                    ? Math.round((syncProgress.current / syncProgress.total) * 100)
                    : 0}
                  %
                </span>
              </div>

              <Progress
                value={
                  syncProgress.total > 0
                    ? (syncProgress.current / syncProgress.total) * 100
                    : 0
                }
                className="h-2.5 bg-muted"
                indicatorClassName="bg-primary transition-all duration-300"
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>
                  Uploading batch {syncProgress.batch} of {syncProgress.totalBatches}
                </span>
                <span className="font-semibold font-mono text-foreground">
                  {syncProgress.current} / {syncProgress.total} images
                </span>
              </div>
            </div>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto space-y-1 py-2">
              <div className="flex items-center justify-between px-2 pb-2 border-b text-xs text-muted-foreground">
                <span>Select Categories</span>
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = categoryOptions.every((c) => syncCategories[c.label]);
                    const next: Record<string, boolean> = {};
                    categoryOptions.forEach((c) => {
                      next[c.label] = !allSelected;
                    });
                    setSyncCategories(next);
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  {categoryOptions.every((c) => syncCategories[c.label])
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              {categoryOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories found.</p>
              ) : (
                categoryOptions.map((cat) => (
                  <label
                    key={cat.label}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={!!syncCategories[cat.label]}
                        onCheckedChange={(checked) =>
                          setSyncCategories((prev) => ({ ...prev, [cat.label]: checked === true }))
                        }
                      />
                      <span className="text-sm font-medium">{cat.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{cat.count} image(s)</span>
                  </label>
                ))
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSyncDialogOpen(false)}
              disabled={isSyncing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSync}
              disabled={isSyncing || selectedSyncCategories.length === 0}
              className="gap-1.5"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing ({syncProgress.current}/{syncProgress.total})
                </>
              ) : (
                `Sync ${selectedSyncCategories.length > 0 ? `(${selectedSyncCategories.length})` : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
