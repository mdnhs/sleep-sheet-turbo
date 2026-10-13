"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMediaLibrary } from "@/features/media/api/use-media";
import { MediaThumb } from "@/features/media/components/media-thumb";
import type { MediaItem } from "@/features/media/types";

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "image" | "video";
  /** Pick several files (images) or exactly one (video). */
  multiple?: boolean;
  /** URLs the form already holds: shown as added and not pickable again. */
  exclude?: string[];
  /** Narrows the files offered, e.g. to the ones a field's server check accepts. */
  accept?: (item: MediaItem) => boolean;
  onSelect: (urls: string[]) => void;
}

/**
 * Picks files already in the R2 media library (Dashboard → Media) so a form can
 * reuse them instead of uploading the same file again. Returns their public URLs.
 */
export function MediaPicker({ open, onOpenChange, kind, multiple = false, exclude = [], accept, onSelect }: MediaPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose {kind === "image" ? (multiple ? "images" : "an image") : "a video"} from the library</DialogTitle>
          <DialogDescription>Files already stored in R2. Nothing is uploaded again.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the selection starts empty each time. */}
        <PickerBody
          kind={kind}
          multiple={multiple}
          exclude={exclude}
          accept={accept}
          onCancel={() => onOpenChange(false)}
          onConfirm={(urls) => {
            onSelect(urls);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  kind,
  multiple,
  exclude,
  accept,
  onCancel,
  onConfirm,
}: {
  kind: "image" | "video";
  multiple: boolean;
  exclude: string[];
  accept?: (item: MediaItem) => boolean;
  onCancel: () => void;
  onConfirm: (urls: string[]) => void;
}) {
  const { data, isLoading, isError, error, refetch, isFetching } = useMediaLibrary();
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);

  const taken = useMemo(() => new Set(exclude), [exclude]);
  const items = useMemo(() => (data?.items ?? []).filter((i) => i.kind === kind && (!accept || accept(i))), [data, kind, accept]);
  const folders = useMemo(() => [...new Set(items.map((i) => i.folder || "(root)"))].sort(), [items]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (folder === "all" || (i.folder || "(root)") === folder) &&
        (!q || i.key.toLowerCase().includes(q) || i.usedBy.some((u) => u.label.toLowerCase().includes(q))),
    );
  }, [items, folder, search]);

  const toggle = (url: string) =>
    setSelected((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      return multiple ? [...prev, url] : [url];
    });

  const noun = kind === "image" ? "image" : "video";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search file or where it's used"
            className="pl-9"
          />
        </div>
        <Select
          value={folder}
          onValueChange={(v) => setFolder(v ?? "all")}
          items={{ all: "All folders", ...Object.fromEntries(folders.map((f) => [f, f])) }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All folders</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="min-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-destructive">{error.message}</p>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : data && !data.configured ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            R2 is not set up yet. Add the bucket and keys under{" "}
            <Link href="/dashboard/settings/cdn" className="font-medium underline">
              Settings → CDN
            </Link>
            .
          </p>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {items.length === 0 ? `No ${noun}s in the library yet.` : `No ${noun}s match these filters.`}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {visible.map((item) => {
              const added = taken.has(item.url);
              const order = selected.indexOf(item.url);
              const isSelected = order !== -1;
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={added}
                  onClick={() => toggle(item.url)}
                  aria-pressed={isSelected}
                  title={item.key}
                  className={`relative overflow-hidden rounded-xl border bg-background p-1 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected ? "ring-2 ring-primary" : "hover:border-primary/50"
                  }`}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg">
                    <MediaThumb item={item} size={240} />
                  </div>
                  <p className="mt-1 truncate px-0.5 text-[11px]">{item.name}</p>
                  {isSelected && (
                    <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {multiple ? order + 1 : <Check className="h-3 w-3" />}
                    </span>
                  )}
                  {added && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      Added
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <DialogFooter className="items-center">
        <span className="mr-auto text-xs text-muted-foreground">
          {selected.length > 0 ? `${selected.length} selected` : data?.truncated ? "Showing the first 10,000 files" : ""}
        </span>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={selected.length === 0} onClick={() => onConfirm(selected)}>
          {multiple && selected.length > 1 ? `Add ${selected.length} ${noun}s` : `Use ${noun}`}
        </Button>
      </DialogFooter>
    </>
  );
}
