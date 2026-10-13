/* eslint-disable @next/next/no-img-element -- ad assets are shown as-is, not optimised */
"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Copy, ImagePlus, Loader2, Code2 } from "lucide-react";
import { toast } from "sonner";
import { useUploadAdImage } from "../api/use-promotions";

interface AdAssetsPanelProps {
  assets: string[];
  onUploaded: (url: string) => void;
  onInsert: (url: string) => void;
}

const MAX_SIZE = 5 * 1024 * 1024;

export function AdAssetsPanel({ assets, onUploaded, onInsert }: AdAssetsPanelProps) {
  const { mutateAsync, isPending } = useUploadAdImage();

  const onDrop = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          onUploaded(await mutateAsync(file));
        } catch {
          // useUploadAdImage already toasts the error.
        }
      }
    },
    [mutateAsync, onUploaded],
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: { "image/png": [], "image/jpeg": [], "image/webp": [], "image/avif": [], "image/gif": [] },
    maxSize: MAX_SIZE,
    onDrop,
    disabled: isPending,
  });

  const copy = (url: string) => {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Image URL copied"),
      () => toast.error("Could not copy the URL"),
    );
  };

  return (
    <div className="space-y-4 p-4 text-xs text-neutral-300">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
          isDragActive ? "border-sky-400 bg-sky-400/10" : "border-neutral-700 hover:border-neutral-500"
        }`}
      >
        <input {...getInputProps()} />
        {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
        <p>{isPending ? "Uploading…" : "Drop images here, or click to choose (PNG, JPG, WebP, AVIF, GIF · max 5MB)"}</p>
      </div>
      {fileRejections.length > 0 && (
        <p className="text-red-400">{fileRejections[0].errors[0].message}</p>
      )}

      {assets.length === 0 ? (
        <p className="text-neutral-500">No images yet. Uploaded images and any image URLs already in your code show up here.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {assets.map((url) => (
            <li key={url} className="flex gap-3 rounded-lg bg-neutral-800/60 p-2">
              <img src={url} alt="" className="h-16 w-16 shrink-0 rounded-md bg-neutral-700 object-cover" />
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <p className="truncate text-neutral-400" title={url}>
                  {url.split("/").pop()}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copy(url)}
                    className="flex items-center gap-1 rounded-md bg-neutral-700 px-2 py-1 hover:bg-neutral-600"
                  >
                    <Copy className="h-3 w-3" />
                    Copy URL
                  </button>
                  <button
                    type="button"
                    onClick={() => onInsert(url)}
                    className="flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-white hover:bg-sky-500"
                  >
                    <Code2 className="h-3 w-3" />
                    Insert &lt;img&gt;
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
