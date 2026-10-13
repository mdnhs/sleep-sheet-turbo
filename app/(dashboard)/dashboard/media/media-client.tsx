"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/dashboard-page-title";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrent } from "@/features/auth/api/use-current";
import { type InUse, useDeleteMedia, useMediaLibrary, useUploadMedia } from "@/features/media/api/use-media";
import { MEDIA_UPLOAD_FOLDERS, type MediaItem, type MediaUploadFolder } from "@/features/media/types";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { isAllowed } from "@/lib/permissions";
import { getOptimizedImageUrl } from "@/lib/utils";
import { MediaThumb } from "@/features/media/components/media-thumb";
import { MediaGridSkeleton } from "./media-skeleton";

const KIND_LABEL: Record<string, string> = {
  product: "Product",
  category: "Category",
  post: "Blog",
  testimonial: "Testimonial",
  setting: "Setting",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function copy(url: string) {
  navigator.clipboard.writeText(url).then(
    () => toast.success("URL copied"),
    () => toast.error("Could not copy"),
  );
}

export default function MediaClientPage() {
  const mounted = useHasMounted();
  const { data: user } = useCurrent();
  const canWrite = mounted && isAllowed(user ?? null, "products", "write", ["MODERATOR"]);

  const { data, isLoading, isError, error, refetch, isFetching } = useMediaLibrary();
  const upload = useUploadMedia();
  const del = useDeleteMedia();

  const [folder, setFolder] = useState("all");
  const [usage, setUsage] = useState<"all" | "used" | "unused">("all");
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [inUse, setInUse] = useState<{ urls: string[]; inUse: InUse } | null>(null);
  const [uploadFolder, setUploadFolder] = useState<MediaUploadFolder>("library");
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const folders = useMemo(() => [...new Set(items.map((i) => i.folder || "(root)"))].sort(), [items]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (folder === "all" || (i.folder || "(root)") === folder) &&
        (kind === "all" || i.kind === kind) &&
        (usage === "all" || (usage === "used" ? i.usedBy.length > 0 : i.usedBy.length === 0)) &&
        (!q || i.key.toLowerCase().includes(q) || i.usedBy.some((u) => u.label.toLowerCase().includes(q))),
    );
  }, [items, folder, kind, usage, search]);
  const totalSize = useMemo(() => visible.reduce((sum, i) => sum + i.size, 0), [visible]);
  const unusedCount = useMemo(() => items.filter((i) => i.usedBy.length === 0).length, [items]);

  const toggle = (url: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(url);
      else next.delete(url);
      return next;
    });

  async function runDelete(urls: string[], force = false) {
    const result = await del.mutateAsync({ urls, force }).catch(() => null);
    if (!result) return;
    if ("inUse" in result) {
      setInUse({ urls, inUse: result.inUse });
      return;
    }
    setSelected((prev) => new Set([...prev].filter((u) => !urls.includes(u))));
    if (open && urls.includes(open.url)) setOpen(null);
  }

  function onFiles(files: FileList | null) {
    const list = [...(files ?? [])];
    if (inputRef.current) inputRef.current.value = "";
    if (!list.length) return;
    setProgress(`Uploading 0/${list.length}…`);
    upload.mutate(
      { files: list, folder: uploadFolder, onProgress: (done, total) => setProgress(`Uploading ${done}/${total}…`) },
      { onSettled: () => setProgress(null) },
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 animate-in fade-in duration-300">
      <PageTitle title="Media" description="Files stored in Cloudflare R2" />

      {data && !data.configured && (
        <div className="rounded-3xl bg-white dark:bg-card p-6 text-sm">
          R2 is not set up yet. Add the bucket and keys under{" "}
          <Link href="/dashboard/settings/cdn" className="font-medium underline">
            Settings → CDN
          </Link>
          .
        </div>
      )}
      {data?.configured && data.provider !== "r2" && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Product, category and blog forms still upload to Cloudinary. Switch “Upload new files to” under{" "}
          <Link href="/dashboard/settings/cdn" className="font-medium underline">
            Settings → CDN
          </Link>{" "}
          to send them here.
        </div>
      )}

      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 space-y-4">
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
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)} items={{ all: "All types", image: "Images", video: "Videos" }}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={usage}
            onValueChange={(v) => setUsage(v as typeof usage)}
            items={{ all: "Used or not", used: "In use", unused: `Unused (${unusedCount})` }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Used or not</SelectItem>
              <SelectItem value="used">In use</SelectItem>
              <SelectItem value="unused">Unused ({unusedCount})</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>

          {canWrite && data?.configured && (
            <div className="ml-auto flex items-center gap-2">
              <Select
                value={uploadFolder}
                onValueChange={(v) => setUploadFolder(v as MediaUploadFolder)}
                items={Object.fromEntries(MEDIA_UPLOAD_FOLDERS.map((f) => [f, `to ${f}`]))}
              >
                <SelectTrigger className="w-36" aria-label="Upload folder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEDIA_UPLOAD_FOLDERS.map((f) => (
                    <SelectItem key={f} value={f}>
                      to {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/quicktime"
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              <Button
                onClick={() => inputRef.current?.click()}
                disabled={upload.isPending}
                className="gap-2 rounded-full px-5 h-9 text-xs font-semibold"
              >
                {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {progress ?? "Upload"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {visible.length} file{visible.length === 1 ? "" : "s"} · {formatSize(totalSize)}
            {data?.truncated && " · showing the first 10,000"}
          </span>
          {canWrite && selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span>{selected.size} selected</span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5 rounded-full" onClick={() => setConfirm([...selected])}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <MediaGridSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-destructive">{error.message}</p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {items.length === 0 ? "No files in R2 yet." : "No files match these filters."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {visible.map((item) => {
              const isSelected = selected.has(item.url);
              return (
                <div
                  key={item.key}
                  className={`group relative overflow-hidden rounded-2xl border bg-background p-2 transition ${isSelected ? "ring-2 ring-primary" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(item)}
                    className="block aspect-square w-full overflow-hidden rounded-xl"
                    aria-label={`Open ${item.name}`}
                  >
                    <MediaThumb item={item} size={320} />
                  </button>
                  {canWrite && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(v) => toggle(item.url, v === true)}
                      aria-label={`Select ${item.name}`}
                      className={`absolute left-3 top-3 bg-white/90 ${isSelected ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}
                    />
                  )}
                  <div className="mt-2 space-y-1 px-0.5">
                    <p className="truncate text-xs font-medium" title={item.key}>
                      {item.name}
                    </p>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                      <span>{formatSize(item.size)}</span>
                      {item.usedBy.length > 0 ? (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          Used · {item.usedBy.length}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                          Unused
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="sm:max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-6">{open.name}</DialogTitle>
                <DialogDescription>
                  {open.folder || "(root)"} · {formatSize(open.size)} · {formatDate(open.lastModified)}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-xl bg-muted">
                {open.kind === "video" ? (
                  <video src={open.url} controls playsInline preload="metadata" className="max-h-[60vh] w-full" />
                ) : open.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- already resized by getOptimizedImageUrl
                  <img src={getOptimizedImageUrl(open.url, 1200)} alt={open.name} className="max-h-[60vh] w-full object-contain" />
                ) : (
                  <div className="aspect-video">
                    <MediaThumb item={open} size={600} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={open.url} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" size="icon" onClick={() => copy(open.url)} aria-label="Copy URL">
                  <Copy className="h-4 w-4" />
                </Button>
                <a
                  href={open.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open in a new tab"
                  className={buttonVariants({ variant: "outline", size: "icon" })}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold">Used in</p>
                {open.usedBy.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Not referenced by any product, category, post, testimonial or setting.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {open.usedBy.map((use) => (
                      <li key={`${use.kind}:${use.label}:${use.href}`}>
                        <span className="text-muted-foreground">{KIND_LABEL[use.kind]}:</span>{" "}
                        <Link href={use.href} className="underline underline-offset-2">
                          {use.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {canWrite && (
                <div className="flex justify-end">
                  <Button variant="destructive" size="sm" className="gap-1.5 rounded-full" onClick={() => setConfirm([open.url])}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirm?.length === 1 ? "this file" : `${confirm?.length} files`}?</AlertDialogTitle>
            <AlertDialogDescription>The file is removed from R2 for good. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const urls = confirm ?? [];
                setConfirm(null);
                void runDelete(urls);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!inUse} onOpenChange={(v) => !v && setInUse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Still in use</AlertDialogTitle>
            <AlertDialogDescription>Deleting will break the image or video on these pages:</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {inUse?.inUse.flatMap(({ url, usedBy }) =>
              usedBy.map((use) => (
                <li key={`${url}:${use.kind}:${use.label}`}>
                  <span className="text-muted-foreground">{KIND_LABEL[use.kind]}:</span> {use.label}
                </li>
              )),
            )}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const urls = inUse?.urls ?? [];
                setInUse(null);
                void runDelete(urls, true);
              }}
            >
              Delete anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
