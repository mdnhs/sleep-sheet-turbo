"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client } from "@/lib/rpc";
import type { VideoUploadTicket } from "@/lib/media";
import type { MediaItem, MediaUploadFolder, MediaUse } from "@/features/media/types";

const MEDIA_KEY = ["media"] as const;

export type MediaLibrary = {
  configured: boolean;
  provider: "cloudinary" | "r2";
  items: MediaItem[];
  truncated: boolean;
};

export type InUse = { url: string; usedBy: MediaUse[] }[];

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // Non-JSON body: use the fallback.
  }
  return fallback;
}

export const useMediaLibrary = () =>
  useQuery({
    queryKey: MEDIA_KEY,
    queryFn: async () => {
      const res = await client.api.media.$get();
      if (!res.ok) throw new Error(await errorMessage(res, "Failed to load media"));
      return (await res.json()) as MediaLibrary;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

/** Images go through the server (resized there); videos straight to R2. */
export const useUploadMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      files,
      folder,
      onProgress,
    }: {
      files: File[];
      folder: MediaUploadFolder;
      onProgress?: (done: number, total: number) => void;
    }) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      const videos = files.filter((f) => f.type.startsWith("video/"));
      const total = files.length;
      let done = 0;

      if (images.length) {
        const body = new FormData();
        body.set("folder", folder);
        for (const file of images) body.append("files", file);
        const res = await fetch("/api/media/upload", { method: "POST", body });
        if (!res.ok) throw new Error(await errorMessage(res, "Image upload failed"));
        done += images.length;
        onProgress?.(done, total);
      }

      for (const file of videos) {
        const res = await client.api.media["video-ticket"].$post({ json: { type: file.type, size: file.size } });
        if (!res.ok) throw new Error(await errorMessage(res, `${file.name}: could not start the upload`));
        const { ticket } = (await res.json()) as { ticket: VideoUploadTicket };
        if (ticket.provider !== "r2") throw new Error("Unexpected upload target");
        const put = await fetch(ticket.uploadUrl, { method: "PUT", headers: ticket.headers, body: file });
        if (!put.ok) throw new Error(`${file.name}: upload failed (${put.status})`);
        done += 1;
        onProgress?.(done, total);
      }
      return done;
    },
    onSuccess: (count) => {
      toast.success(count === 1 ? "File uploaded" : `${count} files uploaded`);
      queryClient.invalidateQueries({ queryKey: MEDIA_KEY });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Upload failed");
      queryClient.invalidateQueries({ queryKey: MEDIA_KEY });
    },
  });
};

/**
 * Resolves `{ inUse }` instead of deleting when any file is still referenced
 * and `force` isn't set, so the page can ask first.
 */
export const useDeleteMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ urls, force }: { urls: string[]; force?: boolean }): Promise<{ deleted: number } | { inUse: InUse }> => {
      const res = await client.api.media.delete.$post({ json: { urls, force } });
      if (res.status === 409) return { inUse: ((await res.json()) as { inUse: InUse }).inUse };
      if (!res.ok) throw new Error(await errorMessage(res, "Delete failed"));
      return (await res.json()) as { deleted: number };
    },
    onSuccess: (result) => {
      if ("deleted" in result) {
        toast.success(result.deleted === 1 ? "File deleted" : `${result.deleted} files deleted`);
        queryClient.invalidateQueries({ queryKey: MEDIA_KEY });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Delete failed");
      queryClient.invalidateQueries({ queryKey: MEDIA_KEY });
    },
  });
};
