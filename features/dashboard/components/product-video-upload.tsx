"use client";

import { useRef, useState } from "react";
import { Film, Loader2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PRODUCT_VIDEO_FORMATS,
  PRODUCT_VIDEO_MAX_BYTES,
  productVideoPoster,
  productVideoUrl,
} from "@/lib/product-video";

interface ProductVideoUploadProps {
  /** Stored Cloudinary video URL, or "" for no video. */
  value: string;
  onChange: (url: string) => void;
}

interface Signature {
  success: boolean;
  error?: string;
  cloudName: string;
  apiKey: string;
  signature: string;
  params: Record<string, string | number>;
}

const MAX_MB = PRODUCT_VIDEO_MAX_BYTES / (1024 * 1024);
const ALLOWED_MIME = ["video/mp4", "video/quicktime", "video/webm"];

/**
 * Uploads one product video straight to Cloudinary (a video is too big for the
 * app's own request body). The server only signs the upload; the form stores
 * the returned URL and saves it with the rest of the product. Removing it just
 * clears the field — the old file is deleted from Cloudinary when the product
 * is saved.
 */
export function ProductVideoUpload({ value, onChange }: ProductVideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const uploading = progress !== null;

  async function upload(file: File) {
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error(`Unsupported video type. Use ${PRODUCT_VIDEO_FORMATS.join(", ").toUpperCase()}.`);
      return;
    }
    if (file.size > PRODUCT_VIDEO_MAX_BYTES) {
      toast.error(`Video is too large (max ${MAX_MB}MB). Trim it or lower the resolution.`);
      return;
    }

    setProgress(0);
    try {
      const res = await fetch("/api/product/video-signature", { method: "POST" });
      const signed = (await res.json()) as Signature;
      if (!res.ok || !signed.success) throw new Error(signed.error || "Could not start the upload");

      const body = new FormData();
      body.append("file", file);
      body.append("api_key", signed.apiKey);
      body.append("signature", signed.signature);
      for (const [key, val] of Object.entries(signed.params)) body.append(key, String(val));

      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${signed.cloudName}/video/upload`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText) as { secure_url?: string; error?: { message?: string } };
            if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
            else reject(new Error(data.error?.message || "Upload failed"));
          } catch {
            reject(new Error("Upload failed"));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("cancelled"));
        xhr.send(body);
      });

      onChange(url);
      toast.success("Video uploaded — save the product to keep it.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      if (message !== "cancelled") toast.error(message);
    } finally {
      xhrRef.current = null;
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {value ? (
        <div className="space-y-2">
          <video
            controls
            playsInline
            preload="metadata"
            poster={productVideoPoster(value)}
            className="w-full max-w-sm rounded-lg border bg-black aspect-video"
          >
            {/* The compressed rendition first; the original upload if it isn't ready yet. */}
            <source src={productVideoUrl(value)} type="video/mp4" />
            <source src={value} />
          </video>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" /> Replace
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              className="text-destructive"
              onClick={() => onChange("")}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-primary/50 disabled:opacity-60 dark:border-slate-700"
        >
          <Film size={32} className="text-muted-foreground" />
          <span className="text-sm font-medium">Upload a product video</span>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            MP4, MOV or WEBM, up to {MAX_MB}MB — a short clip (10–30 seconds) works best
          </span>
        </button>
      )}

      {uploading && (
        <div className="space-y-1.5" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading… {progress}%
            </span>
            <button
              type="button"
              onClick={() => xhrRef.current?.abort()}
              className="flex items-center gap-1 text-destructive hover:underline"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
          <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
